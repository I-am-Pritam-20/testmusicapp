package com.musickit.network

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/**
 * Real internet-reachability detection — not just "is there a network
 * interface". A device can be attached to wifi with no working ISP, or
 * sitting behind a captive portal, and Android's own
 * NET_CAPABILITY_VALIDATED will still be true in some of those cases.
 *
 * Method (matches the approach in netinfo_checker.md): a lightweight HTTP
 * GET to a generate_204-style endpoint with redirects disabled. A real
 * 204 means real internet; a captive portal answers with a 302 redirect
 * to its login page instead, which is correctly read as "not online".
 *
 * The exact probe host is upgraded from the doc's example
 * (clients3.google.com, the old KitKat-era endpoint) to
 * connectivitycheck.gstatic.com, the endpoint Android itself has used
 * internally for this exact check since Marshmallow — this app's minSdk
 * is 24 (Nougat), so that's the correct modern host — with a Cloudflare
 * endpoint as a second attempt if the first is blocked on some network.
 */
class NetworkReachabilityModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TurboModule {

  companion object {
    const val NAME = "NetworkReachabilityModule"
    private const val PRIMARY_CHECK_URL = "https://connectivitycheck.gstatic.com/generate_204"
    private const val FALLBACK_CHECK_URL = "https://cp.cloudflare.com/generate_204"
    private const val CONNECT_TIMEOUT_MS = 4000
    private const val READ_TIMEOUT_MS = 4000

    // "Avoid checking too frequently. Cache results for 10-30 seconds" —
    // netinfo_checker.md's own best-practice guidance.
    private const val MIN_RECHECK_INTERVAL_MS = 10_000L
  }

  override fun getName(): String = NAME

  private val connectivityManager: ConnectivityManager
    get() = reactContext.getSystemService(ReactApplicationContext.CONNECTIVITY_SERVICE) as ConnectivityManager

  private val moduleScope = CoroutineScope(Dispatchers.IO + Job())
  private var lastCheckedAtMs = 0L
  private var lastResult: WritableMap? = null
  private var networkCallback: ConnectivityManager.NetworkCallback? = null
  private var listenerCount = 0

  // --- JS-facing API ----------------------------------------------------

  /** One-shot, always-fresh check — used for the initial app-launch
   *  decision (online vs offline homescreen) and for a manual "Go Online"
   *  retry tap, so those two cases always force=true. */
  @ReactMethod
  fun checkNow(promise: Promise) {
    moduleScope.launch {
      val result = performCheck(force = true)
      withContext(Dispatchers.Main) { promise.resolve(result) }
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    listenerCount += 1
    if (networkCallback == null) registerNetworkCallback()
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    listenerCount = (listenerCount - count.toInt()).coerceAtLeast(0)
    if (listenerCount == 0) unregisterNetworkCallback()
  }

  override fun invalidate() {
    super.invalidate()
    unregisterNetworkCallback()
    listenerCount = 0
  }

  // --- Native side --------------------------------------------------------

  private fun registerNetworkCallback() {
    val request = NetworkRequest.Builder()
        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        .build()

    val callback = object : ConnectivityManager.NetworkCallback() {
      override fun onAvailable(network: Network) {
        moduleScope.launch { emit(performCheck(force = true)) }
      }

      override fun onLost(network: Network) {
        moduleScope.launch { emit(offlineResult()) }
      }

      override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
        // A capability flip (e.g. the captive-portal flag clearing right
        // after the user logs into a portal page) is exactly the case a
        // plain isConnected/NetInfo check misses — re-verify with the
        // real HTTP probe rather than trusting NET_CAPABILITY_VALIDATED.
        moduleScope.launch { emit(performCheck(force = false)) }
      }
    }
    networkCallback = callback
    connectivityManager.registerNetworkCallback(request, callback)
  }

  private fun unregisterNetworkCallback() {
    networkCallback?.let {
      try {
        connectivityManager.unregisterNetworkCallback(it)
      } catch (e: IllegalArgumentException) {
        // Already unregistered — safe to ignore.
      }
    }
    networkCallback = null
  }

  private fun hasAnyTransport(): Boolean {
    val network = connectivityManager.activeNetwork ?: return false
    val caps = connectivityManager.getNetworkCapabilities(network) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
  }

  private suspend fun performCheck(force: Boolean): WritableMap {
    val now = System.currentTimeMillis()
    val cached = lastResult
    if (!force && cached != null && now - lastCheckedAtMs < MIN_RECHECK_INTERVAL_MS) {
      return cached
    }

    val result = if (!hasAnyTransport()) {
      offlineResult()
    } else {
      val reachable = withContext(Dispatchers.IO) {
        probe(PRIMARY_CHECK_URL) || probe(FALLBACK_CHECK_URL)
      }
      Arguments.createMap().apply {
        putString("status", if (reachable) "online" else "offline")
        putBoolean("hasTransport", true)
      }
    }

    lastCheckedAtMs = now
    lastResult = result
    return result
  }

  private fun offlineResult(): WritableMap =
      Arguments.createMap().apply {
        putString("status", "offline")
        putBoolean("hasTransport", hasAnyTransport())
      }

  /** A single generate_204-style probe. Redirects are disabled on purpose:
   *  a captive portal answers with a 302 to its login page instead of a
   *  204, and following that redirect would make the portal's own page
   *  look like a normal successful response. */
  private fun probe(urlString: String): Boolean =
      try {
        val connection = URL(urlString).openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        connection.connectTimeout = CONNECT_TIMEOUT_MS
        connection.readTimeout = READ_TIMEOUT_MS
        connection.instanceFollowRedirects = false
        val code = connection.responseCode
        connection.disconnect()
        code == 204
      } catch (e: Exception) {
        false
      }

  private fun emit(result: WritableMap) {
    if (listenerCount <= 0) return
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("onConnectivityChanged", result)
  }
}

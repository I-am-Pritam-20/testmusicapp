package com.testmusicapp.widget

import android.content.Context
import android.graphics.*
import androidx.core.graphics.ColorUtils
import java.io.File

object WidgetRenderer {

    fun buildBackground(
        context: Context,
        state: WidgetState,
        widthPx: Int,
        heightPx: Int,
    ): Bitmap {
        // ARGB_8888 so alpha is preserved — the launcher composites this over
        // the home screen wallpaper, giving the "see-through" effect for dominant/gradient modes.
        val bmp    = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        // Corner radius fixed at 28dp — no longer configurable from settings
        val corner = (28f * context.resources.displayMetrics.density)
        val paint  = Paint(Paint.ANTI_ALIAS_FLAG)
        val rect   = RectF(0f, 0f, widthPx.toFloat(), heightPx.toFloat())

        when (state.bgStyle) {
            "artwork"  -> drawArtworkBg(context, state, canvas, rect, corner, paint)
            "gradient" -> drawGradientBg(state, canvas, rect, corner, paint)
            else       -> drawDominantBg(state, canvas, rect, corner, paint)
        }

        // Additional dark scrim over artwork bg for text legibility
        // Dominant/gradient modes already embed their alpha, so skip extra scrim for those
        if (state.bgStyle == "artwork") {
            paint.shader = null
            paint.color  = Color.argb(80, 0, 0, 0)
            canvas.drawRoundRect(rect, corner, corner, paint)
        }

        return bmp
    }

    // ── Style 1: dominant colour ───────────────────────────────────────────────
    // Fully opaque — the artwork fills the entire widget background with no
    // wallpaper bleed-through. Transparency here looks wrong on most wallpapers.
    private fun drawArtworkBg(
        context: Context, state: WidgetState,
        canvas: Canvas, rect: RectF, corner: Float, paint: Paint,
    ) {
        val art = loadArtwork(state.artworkPath, rect.width().toInt(), rect.height().toInt())
        if (art != null) {
            val blurred = stackBlur(art, 22)
            art.recycle()
            val clipPath = Path().apply { addRoundRect(rect, corner, corner, Path.Direction.CW) }
            canvas.save()
            canvas.clipPath(clipPath)
            // Draw at full opacity — fully opaque for artwork mode
            paint.alpha = 255
            canvas.drawBitmap(blurred, null, rect, paint)
            canvas.restore()
            blurred.recycle()
        } else {
            // Fall back to opaque dominant colour if no artwork
            drawDominantBg(state, canvas, rect, corner, paint, opaque = true)
        }
    }

    // ── Style 3: dominant → black linear gradient ─────────────────────────────
    // Fully opaque — gradient is a deliberate design choice, not a wallpaper overlay.
    private fun drawGradientBg(
        state: WidgetState, canvas: Canvas,
        rect: RectF, corner: Float, paint: Paint,
    ) {
        val r = Color.red(state.dominantColor)
        val g = Color.green(state.dominantColor)
        val b = Color.blue(state.dominantColor)
        // Fully opaque top and bottom stops
        val topColor    = Color.argb(255, r, g, b)
        val bottomColor = Color.argb(255, 0, 0, 0)
        paint.shader = LinearGradient(
            0f, 0f, 0f, rect.height(),
            intArrayOf(topColor, bottomColor), null,
            Shader.TileMode.CLAMP,
        )
        canvas.drawRoundRect(rect, corner, corner, paint)
        paint.shader = null
    }

    // ── Style 1: dominant colour ───────────────────────────────────────────────
    // Semi-transparent (63% opacity) so wallpaper bleeds through — this is the
    // ONLY mode where transparency is intentional (frosted/tinted glass look).
    private fun drawDominantBg(
        state: WidgetState, canvas: Canvas,
        rect: RectF, corner: Float, paint: Paint,
        opaque: Boolean = false,
    ) {
        paint.shader = null
        val r = Color.red(state.dominantColor)
        val g = Color.green(state.dominantColor)
        val b = Color.blue(state.dominantColor)
        // Transparent only for dominant mode (alpha 160 ≈ 63%).
        // opaque=true is used as fallback from artwork mode when no artwork available.
        val alpha = if (opaque) 255 else 160
        paint.color = Color.argb(alpha, r, g, b)
        canvas.drawRoundRect(rect, corner, corner, paint)
    }

    // ── Artwork loading ────────────────────────────────────────────────────────
    // Supports three formats produced by MediaMetadataModule / FileScanner:
    //   1. "data:image/...;base64,<b64>"  -- embedded artwork from MediaMetadataModule
    //   2. "file:///absolute/path"         -- file URI (strip scheme before use)
    //   3. "/absolute/path"                -- bare file path
    fun loadArtwork(path: String, targetW: Int, targetH: Int): Bitmap? {
        if (path.isBlank()) return null
        return try {
            // ── Case 1: base64 data URI ─────────────────────────────────────
            if (path.startsWith("data:")) {
                val commaIdx = path.indexOf(',')
                if (commaIdx < 0) return null
                val b64 = path.substring(commaIdx + 1)
                val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
                val raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
                return Bitmap.createScaledBitmap(raw, targetW, targetH, true).also {
                    if (it !== raw) raw.recycle()
                }
            }

            // ── Case 2 & 3: file path (strip file:// prefix if present) ────
            val filePath = if (path.startsWith("file://"))
                android.net.Uri.parse(path).path ?: return null
            else
                path

            val file = File(filePath)
            if (!file.exists()) return null
            val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(filePath, opts)
            opts.inSampleSize        = calcSampleSize(opts, targetW, targetH)
            opts.inJustDecodeBounds  = false
            opts.inPreferredConfig   = Bitmap.Config.ARGB_8888
            val src = BitmapFactory.decodeFile(filePath, opts) ?: return null
            Bitmap.createScaledBitmap(src, targetW, targetH, true).also {
                if (it !== src) src.recycle()
            }
        } catch (_: Exception) { null }
    }

    private fun calcSampleSize(opts: BitmapFactory.Options, rw: Int, rh: Int): Int {
        var s = 1
        var hw = opts.outHeight / 2
        var ww = opts.outWidth  / 2
        while (hw / s >= rh && ww / s >= rw) s *= 2
        return s
    }

    // ── Stack blur (John Underhill / Mario Klingemann algorithm) ─────────────
    // Pure Java/Kotlin — no native libs, no RenderScript, works in release.
    fun stackBlur(src: Bitmap, radius: Int): Bitmap {
        val r  = radius.coerceIn(1, 180)
        val w  = src.width
        val h  = src.height
        val pix = IntArray(w * h)
        src.getPixels(pix, 0, w, 0, 0, w, h)

        val wm  = w - 1
        val hm  = h - 1
        val div = r + r + 1

        val r2 = IntArray(w * h)
        val g2 = IntArray(w * h)
        val b2 = IntArray(w * h)

        var rsum: Int; var gsum: Int; var bsum: Int
        var x: Int; var y: Int; var i: Int
        var p: Int; var yp: Int; var yi: Int

        val vmin = IntArray(maxOf(w, h))
        val divsum = (div + 1) shr 1
        val dvcount = 256 * divsum * divsum

        // Horizontal pass
        y = 0
        while (y < h) {
            rsum = 0; gsum = 0; bsum = 0
            yi = y * w
            i = -r
            while (i <= r) {
                p = pix[yi + minOf(wm, maxOf(i, 0))]
                rsum += (p shr 16) and 0xff
                gsum += (p shr  8) and 0xff
                bsum +=  p         and 0xff
                i++
            }
            x = 0
            while (x < w) {
                r2[yi + x] = rsum
                g2[yi + x] = gsum
                b2[yi + x] = bsum
                if (y == 0) vmin[x] = minOf(x + r + 1, wm)
                val p1 = pix[yi + vmin[x]]
                val p2 = pix[yi + maxOf(x - r, 0)]
                rsum += ((p1 shr 16) and 0xff) - ((p2 shr 16) and 0xff)
                gsum += ((p1 shr  8) and 0xff) - ((p2 shr  8) and 0xff)
                bsum += ( p1         and 0xff) - ( p2         and 0xff)
                x++
            }
            y++
        }

        // Vertical pass
        x = 0
        while (x < w) {
            rsum = 0; gsum = 0; bsum = 0
            yp = -r * w
            i = -r
            while (i <= r) {
                yi = maxOf(0, yp) + x
                rsum += r2[yi]; gsum += g2[yi]; bsum += b2[yi]
                yp += w; i++
            }
            yi = x
            y = 0
            while (y < h) {
                pix[yi] = (-0x1000000
                        or (((rsum / divsum / divsum) and 0xff) shl 16)
                        or (((gsum / divsum / divsum) and 0xff) shl  8)
                        or   (bsum / divsum / divsum) and 0xff)
                if (x == 0) vmin[y] = minOf(y + r + 1, hm) * w
                val p1i = x + vmin[y]
                val p2i = x + maxOf(y - r, 0) * w
                rsum += r2[p1i] - r2[p2i]
                gsum += g2[p1i] - g2[p2i]
                bsum += b2[p1i] - b2[p2i]
                yi += w; y++
            }
            x++
        }

        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        out.setPixels(pix, 0, w, 0, 0, w, h)
        return out
    }

    // ── Dominant colour extraction ────────────────────────────────────────────
    fun extractDominantColor(bmp: Bitmap): Int {
        val scaled = Bitmap.createScaledBitmap(bmp, 24, 24, true)
        val pixels = IntArray(24 * 24)
        scaled.getPixels(pixels, 0, 24, 0, 0, 24, 24)
        scaled.recycle()

        val hsl = FloatArray(3)
        var sumR = 0L; var sumG = 0L; var sumB = 0L; var count = 0

        for (pixel in pixels) {
            ColorUtils.colorToHSL(pixel, hsl)
            if (hsl[1] > 0.2f && hsl[2] > 0.1f && hsl[2] < 0.9f) {
                sumR += Color.red(pixel)
                sumG += Color.green(pixel)
                sumB += Color.blue(pixel)
                count++
            }
        }
        return if (count > 0) {
            Color.rgb(
                (sumR / count).toInt(),
                (sumG / count).toInt(),
                (sumB / count).toInt(),
            )
        } else {
            0xFF7C4DFF.toInt()
        }
    }

    private fun darkenColor(color: Int, factor: Float): Int {
        val r = (Color.red(color)   * (1f - factor)).toInt().coerceIn(0, 255)
        val g = (Color.green(color) * (1f - factor)).toInt().coerceIn(0, 255)
        val b = (Color.blue(color)  * (1f - factor)).toInt().coerceIn(0, 255)
        return Color.rgb(r, g, b)
    }

    private fun Int.dpToPx(context: Context): Int =
        (this * context.resources.displayMetrics.density + 0.5f).toInt()
}
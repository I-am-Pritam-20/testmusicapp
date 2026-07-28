package com.testmusicapp.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class WidgetBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            // Redraw widgets with last saved state
            PlayerWidget.requestUpdate(context)
            // Re-start idle service if widget is still pinned
            // (widget IDs survive reboot via AppWidgetManager)
            WidgetLifecycleManager.checkAndApply(context)
        }
    }
}

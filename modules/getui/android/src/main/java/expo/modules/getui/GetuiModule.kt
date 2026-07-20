package expo.modules.getui

import android.content.Context
import com.igexin.sdk.PushManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PREFS_NAME = "daily_habit_getui"
private const val CLIENT_ID_KEY = "client_id"

class GetuiModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Getui")
    Events("onClientId", "onMessage")

    OnCreate {
      module = this@GetuiModule
    }

    OnDestroy {
      if (module === this@GetuiModule) {
        module = null
      }
    }

    AsyncFunction("initialize") {
      val context = requireContext()
      PushManager.getInstance().preInit(context)
      PushManager.getInstance().initialize(context)
    }

    AsyncFunction("getClientId") {
      requireContext()
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getString(CLIENT_ID_KEY, null)
    }
  }

  private fun requireContext(): Context =
    appContext.reactContext ?: throw IllegalStateException("React context is unavailable")

  companion object {
    private var module: GetuiModule? = null

    fun publishClientId(context: Context, clientId: String) {
      val normalized = clientId.trim()
      if (normalized.isEmpty()) {
        return
      }
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(CLIENT_ID_KEY, normalized)
        .apply()
      module?.sendEvent("onClientId", mapOf("clientId" to normalized))
    }

    fun publishMessage(context: Context, payload: String) {
      if (payload.isEmpty()) {
        return
      }
      module?.sendEvent("onMessage", mapOf("payload" to payload))
    }
  }
}

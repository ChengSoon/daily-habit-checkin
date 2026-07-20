package expo.modules.getui

import android.content.Context
import com.igexin.sdk.GTIntentService
import com.igexin.sdk.message.GTCmdMessage
import com.igexin.sdk.message.GTNotificationMessage
import com.igexin.sdk.message.GTTransmitMessage

class GetuiIntentService : GTIntentService() {
  override fun onReceiveServicePid(context: Context, pid: Int) = Unit

  override fun onReceiveClientId(context: Context, clientid: String) {
    GetuiModule.publishClientId(context, clientid)
  }

  override fun onReceiveMessageData(context: Context, msg: GTTransmitMessage): Boolean {
    val payload = msg.payload?.toString(Charsets.UTF_8).orEmpty()
    GetuiModule.publishMessage(context, payload)
    return true
  }

  override fun onReceiveOnlineState(context: Context, online: Boolean) = Unit

  override fun onReceiveCommandResult(context: Context, cmdMessage: GTCmdMessage) = Unit

  override fun onNotificationMessageArrived(context: Context, msg: GTNotificationMessage) = Unit

  override fun onNotificationMessageClicked(context: Context, msg: GTNotificationMessage) = Unit
}

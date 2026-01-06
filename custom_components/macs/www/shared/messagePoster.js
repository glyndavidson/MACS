import { createDebugger } from "./debugger.js";

const debug = createDebugger("message_poster");

export class MessagePoster {
	constructor({
		sender = "unknown",
		recipient = "unknown",
		getRecipientWindow,
		getTargetOrigin,
		allowNullOrigin = false,
		logSend = true,
		logReceive = true,
	} = {}) {
		this._sender = sender || "unknown";
		this._recipient = recipient || "unknown";
		this._getRecipientWindow = typeof getRecipientWindow === "function" ? getRecipientWindow : () => null;
		this._getTargetOrigin = typeof getTargetOrigin === "function" ? getTargetOrigin : () => "";
		this._allowNullOrigin = !!allowNullOrigin;
		this._logSend = !!logSend;
		this._logReceive = !!logReceive;
	}

	post(payload) {
		const recipient = this._getRecipientWindow();
		const origin = this._getTargetOrigin();
		if (!recipient || !origin) return false;
		try {
			if (this._logSend) {
				debug("postmessage:send", {
					sender: this._sender,
					recipient: this._recipient,
					// origin,
					message: payload,
				});
			}
			recipient.postMessage(payload, origin);
			return true;
		} catch (_) {
			return false;
		}
	}

	isValidEvent(event) {
		if (!event || typeof event !== "object") return false;
		const recipient = this._getRecipientWindow();
		if (recipient && event.source !== recipient) return false;
		const origin = this._getTargetOrigin();
		if (origin && event.origin !== origin) {
			if (!(this._allowNullOrigin && event.origin === "null")) return false;
		}
		if (this._logReceive) {
			debug("postmessage:receive", {
				sender: this._recipient,
				recipient: this._sender,
				// origin: event.origin || "",
				message: event.data,
			});
		}
		return true;
	}
}

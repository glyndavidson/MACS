/**
 * Message Listener
 * ----------------
 * Shared postMessage listener with origin filtering and routing.
 */
export class MessageListener {
	constructor({
		recipient = "unknown",
		getExpectedOrigin,
		getExpectedSource,
		allowNullOrigin = false,
		onMessage,
	} = {}) {
		this._recipient = recipient || "unknown";
		this._getExpectedOrigin = typeof getExpectedOrigin === "function" ? getExpectedOrigin : () => "";
		this._getExpectedSource = typeof getExpectedSource === "function" ? getExpectedSource : () => null;
		this._allowNullOrigin = !!allowNullOrigin;
		this._onMessage = typeof onMessage === "function" ? onMessage : null;
		this._boundHandler = this._handleMessage.bind(this);
		this._listening = false;
	}

	start() {
		if (this._listening) return;
		window.addEventListener("message", this._boundHandler);
		this._listening = true;
	}

	stop() {
		if (!this._listening) return;
		window.removeEventListener("message", this._boundHandler);
		this._listening = false;
	}

	_handleMessage(event) {
		if (!this._isValidEvent(event)) return;
		const payload = event.data;
		if (!payload || typeof payload !== "object") return;
		const target = (payload.recipient || "").toString().trim().toLowerCase();
		if (target && target !== "all" && target !== this._recipient.toLowerCase()) return;
		if (this._onMessage) this._onMessage(payload, event);
	}

	_isValidEvent(event) {
		if (!event || typeof event !== "object") return false;
		const expectedSource = this._getExpectedSource();
		if (expectedSource && event.source !== expectedSource) return false;
		const expectedOrigin = this._getExpectedOrigin();
		if (expectedOrigin && event.origin !== expectedOrigin) {
			if (!(this._allowNullOrigin && event.origin === "null")) return false;
		}
		return true;
	}
}

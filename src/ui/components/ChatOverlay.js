export class ChatOverlay {
    constructor() {
        this.overlay = document.getElementById("chat-overlay");
        this.messagesEl = document.getElementById("chat-messages");
        this.inputEl = document.getElementById("chat-input");
        this.sendBtn = document.getElementById("send-chat-btn");
        this.toggleBtn = document.getElementById("chat-toggle-btn");
        this.header = document.querySelector(".chat-header");

        this.initListeners();
    }

    initListeners() {
        const toggle = (e) => {
            if (e) e.stopPropagation();
            const isCollapsed = this.overlay.classList.toggle("collapsed");
            if (this.toggleBtn) this.toggleBtn.textContent = isCollapsed ? "+" : "−";
        };

        if (this.toggleBtn) this.toggleBtn.onclick = toggle;
        if (this.header) this.header.onclick = toggle;
    }

    setupSendListener(onSend) {
        const send = () => {
            const text = this.inputEl.value.trim();
            if (text) {
                onSend(text);
                this.inputEl.value = "";
            }
        };
        this.sendBtn.onclick = send;
        this.inputEl.onkeypress = (e) => {
            if (e.key === "Enter") send();
        };
    }

    renderMessages(messages) {
        this.messagesEl.innerHTML = "";
        for (const msg of messages) {
            const el = document.createElement("div");
            el.className = "chat-msg";
            el.innerHTML = `<span class="chat-name">${msg.userName}:</span> ${msg.text}`;
            this.messagesEl.appendChild(el);
        }
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    setVisible(visible) {
        if (visible) this.overlay.classList.remove("hidden");
        else this.overlay.classList.add("hidden");
    }
}

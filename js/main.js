"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mdui_1 = require("mdui");
function containsOrEqual(parent, child) {
    return parent && child && (parent === child || mdui_1.$.contains(parent, child));
}
function copyKbdEvent(evt) {
    const opts = {};
    for (const key in evt) {
        //@ts-ignore
        const value = evt[key];
        opts[key] = value;
    }
    const evt2 = new KeyboardEvent(evt.type, opts);
    return evt2;
}
mdui_1.$.extend({
    containsOrEqual: containsOrEqual
});
let activePopupCardBtn = null;
let activePopupCard = null;
function hidePopupCard() {
    activePopupCard && (activePopupCard.addClass("hidden"), activePopupCard.trigger("card-hide"));
    activePopupCardBtn && activePopupCardBtn.removeAttr("selected");
    activePopupCard = null;
    activePopupCardBtn = null;
}
(0, mdui_1.$)("#taskbar").on('change', (evt) => {
    const btn = evt.target;
    const toggle = (0, mdui_1.$)(btn.dataset.toggle);
    if (toggle) {
        if (btn.selected) {
            hidePopupCard();
            toggle.removeClass("hidden");
            activePopupCardBtn = (0, mdui_1.$)(btn);
            activePopupCard = toggle;
            activePopupCard.trigger("card-show");
        }
        else
            toggle.addClass("hidden");
    }
});
(0, mdui_1.$)("#screen").on("click", (evt) => {
    if (!activePopupCard || !activePopupCardBtn)
        return;
    const target = evt.target;
    if (!containsOrEqual(activePopupCard.get(0), target)
        && !containsOrEqual(activePopupCardBtn.get(0), target)) {
        hidePopupCard();
    }
});
//@ts-ignore
(0, mdui_1.$)("#screen").on("keydown", (evt) => {
    if (!activePopupCard || !activePopupCardBtn)
        return;
    const target = evt.target;
    if (evt.key == "Escape") {
        evt.preventDefault();
        hidePopupCard();
    }
});
(0, mdui_1.$)("#launcher").on("card-show", () => { (0, mdui_1.$)("#search").val("")[0].focus(); });
const WS_MINIMIZED = 1 << 0;
const WS_MAXIMIZED = 1 << 1;
class SurfaceManager {
    constructor(screen) {
        this.evtListenerCnt = 0;
        this.screen = screen;
        this.ptrSurface = document.createElement("div");
        this.ptrSurface.className = "ptrSurface";
        this.ptrSurface.style.display = "none";
        this.screen.appendChild(this.ptrSurface);
        this.addEventListener = this.screen.addEventListener.bind(this.screen);
        this.removeEventListener = this.screen.removeEventListener.bind(this.screen);
        this.dispatchEvent = this.screen.dispatchEvent.bind(this.screen);
    }
    addPtrEventListener(type, listener, options) {
        this.evtListenerCnt++;
        if (this.evtListenerCnt) {
            this.ptrSurface.style.display = "";
        }
        this.ptrSurface.addEventListener(type, listener, options);
    }
    removePtrEventListener(type, listener, options) {
        this.ptrSurface.removeEventListener(type, listener, options);
        this.evtListenerCnt--;
        if (!this.evtListenerCnt) {
            this.ptrSurface.style.display = "none";
        }
    }
    lockCursor(cursor) {
        this.ptrSurface.style.cursor = cursor || "";
    }
}
class WindowManager {
    constructor(sm, windowEl) {
        this.windows = [];
        this.hooks = {};
        this.lastNoActive = true;
        this.sm = sm;
        this.windowEl = windowEl;
        this.addEventListener = this.windowEl.addEventListener.bind(this.windowEl);
        this.removeEventListener = this.windowEl.removeEventListener.bind(this.windowEl);
        this.addPtrEventListener = this.sm.addPtrEventListener.bind(this.sm);
        this.removePtrEventListener = this.sm.removePtrEventListener.bind(this.sm);
        this.lockCursor = this.sm.lockCursor.bind(this.sm);
        this.dispatchEvent = this.windowEl.dispatchEvent.bind(this.windowEl);
    }
    lenWindows() {
        return this.windows.length;
    }
    getWindows() {
        return [...this.windows];
    }
    /* friend */ addHook(target, hook) {
        if (!this.hooks[target])
            this.hooks[target] = [];
        this.hooks[target].push(hook);
    }
    /* friend */ removeHook(target, hook) {
        if (!this.hooks[target] || !this.hooks[target].includes(hook)) {
            throw new Error("Target not found");
        }
        this.hooks[target].splice(this.hooks[target].indexOf(hook), 1);
    }
    getHooks(target) {
        return this.hooks[target] || [];
    }
    bind(window, div) {
        this.windowEl.appendChild(div);
        this.activate(null);
        this.windows.push(window);
        for (const hookFunc of this.getHooks("bind")) {
            hookFunc(window);
        }
        this.activate(window);
    }
    findWindowIdx(window) {
        return this.windows.indexOf(window);
    }
    findWindowIdxA(window) {
        const idx = this.windows.indexOf(window);
        if (idx == -1)
            throw new Error("Window not found");
        return idx;
    }
    close(window) {
        const idx = this.findWindowIdxA(window);
        this.windows.splice(idx, 1);
        window._close();
        if (!this.lastNoActive && this.windows.length) {
            this.activate(this.windows[idx - 1]);
        }
        else {
            this.activate(null);
        }
        for (const hookFunc of this.getHooks("close")) {
            hookFunc(window);
        }
    }
    activate(window) {
        if (!window) {
            if (this.windows.length && !this.lastNoActive)
                this.windows[this.windows.length - 1]._deactivate();
            this.lastNoActive = true;
            for (const hookFunc of this.getHooks("activate")) {
                hookFunc(null);
            }
            return;
        }
        const idx = this.findWindowIdx(window);
        if (idx == -1)
            return;
        if (idx != this.windows.length - 1)
            this.windows[this.windows.length - 1]._deactivate();
        this.lastNoActive = false;
        const zIdx = window.zIndex;
        if (zIdx <= 0)
            return;
        for (const w of this.windows) {
            if (w.zIndex > zIdx && w.zIndex <= this.windows.length)
                w.zIndex--;
        }
        window.zIndex = this.windows.length;
        this.windows.splice(idx, 1);
        this.windows.push(window);
        window.state &= ~WS_MINIMIZED;
        window._activate();
        for (const hookFunc of this.getHooks("activate")) {
            hookFunc(window);
        }
    }
    deactivate(window) {
        const idx = this.findWindowIdxA(window);
        if (!this.lastNoActive && this.windows.length) {
            for (let i = idx - 1; i >= 0; i--) {
                if (!(this.windows[i].state & WS_MINIMIZED)) {
                    this.activate(this.windows[i]);
                    return;
                }
            }
        }
        this.activate(null);
    }
    /* friend */ get style() {
        return this.windowEl.style;
    }
    get x() {
        return this.windowEl.clientLeft;
    }
    get y() {
        return this.windowEl.clientTop;
    }
    get width() {
        return this.windowEl.clientWidth;
    }
    get height() {
        return this.windowEl.clientHeight;
    }
}
class BaseWindow {
    constructor(wm, x = 20, y = 20, width = 100, height = 100, title = "", state = 0) {
        this._x = 0;
        this._y = 0;
        this._state = 0;
        this._width = 0;
        this._height = 0;
        this._title = "";
        this._zIndex = 0;
        this.wm = wm;
        this.activate = this.wm.activate.bind(this.wm, this);
        this.deactivate = this.wm.deactivate.bind(this.wm, this);
        this.close = this.wm.close.bind(this.wm, this);
        this.div = document.createElement("div");
        this.$div = (0, mdui_1.$)(this.div);
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.zIndex = this.wm.lenWindows() + 1;
        this.div.addEventListener("pointerdown", () => this.activate());
        this.div.addEventListener("focus", () => this.activate());
        this.wm.bind(this, this.div);
        this.state = state;
    }
    get x() {
        return this._x;
    }
    set x(v) {
        this._x = v;
        this.div.style.left = v + "px";
    }
    get y() {
        return this._y;
    }
    set y(v) {
        this._y = v;
        this.div.style.top = v + "px";
    }
    get state() {
        return this._state;
    }
    set state(v) {
        this._state = v;
        if (v & WS_MINIMIZED) {
            this.$div.addClass("minimized");
            this.deactivate();
        }
        else {
            this.$div.removeClass("minimized");
        }
        if (v & WS_MAXIMIZED) {
            this.$div.addClass("maximized");
            this._maximize();
        }
        else {
            this.$div.removeClass("maximized");
            this._restore();
        }
    }
    get width() {
        return this._width;
    }
    set width(v) {
        this._width = v;
        this.div.style.width = v + "px";
    }
    get height() {
        return this._height;
    }
    set height(v) {
        this._height = v;
        this.div.style.height = v + "px";
    }
    get title() {
        return this._title;
    }
    set title(v) {
        this._title = v;
    }
    get zIndex() {
        return this._zIndex;
    }
    /* friend */ set zIndex(v) {
        this._zIndex = v;
        this.div.style.zIndex = v.toString();
    }
    /* friend */ _close() {
        this.div.remove();
    }
    _maximize() {
        // TODO:
    }
    _restore() {
        // TODO:
    }
    /* friend */ _deactivate() {
        // TODO: Dispatch event
    }
    /* friend */ _activate() {
        // TODO: Dispatch event
    }
    maximize() {
        this.state |= WS_MAXIMIZED;
    }
    restore() {
        this.state &= ~WS_MAXIMIZED;
    }
    minimize() {
        this.state |= WS_MINIMIZED;
    }
}
class PkWindow extends BaseWindow {
    constructor(dm, x = 20, y = 20, width = 400, height = 300, title = "", state = 0) {
        super(dm, x, y, width, height, title, state);
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.dragStopHand = this.onwindragstop.bind(this);
        this.dragMoveHand = this.onwindragmove.bind(this);
        this.origX2 = 0;
        this.origY2 = 0;
        this.resizeStopHand = this.onwinresizestop.bind(this);
        this.resizeMoveHand = this.onwinresizemove.bind(this);
        this.activeHand = 0;
        this.titleLastClick = -1;
        this.titleClickCnt = 0;
        this.$div = (0, mdui_1.$)(this.div);
        this.$div.addClass("pkWindow");
        const template = (0, mdui_1.$)("#pkWindowTemplate")[0].content;
        this.div.appendChild(document.importNode(template, true));
        this.titleBar = this.div.querySelector("mdui-top-app-bar");
        this.titleBarTitle = this.titleBar.querySelector("mdui-top-app-bar-title");
        this.title = title;
        this.titleBarTitle.addEventListener("pointerdown", this.onwindragstart.bind(this));
        (0, mdui_1.$)(this.titleBar.querySelector('mdui-button-icon[name="minimize"]')).on("click", this.minimize.bind(this));
        this.maximizeBtn = this.titleBar.querySelector('mdui-button-icon[name="maximize"]');
        (0, mdui_1.$)(this.maximizeBtn).on("click", this.maximize.bind(this));
        this.restoreBtn = this.titleBar.querySelector('mdui-button-icon[name="restore"]');
        (0, mdui_1.$)(this.restoreBtn).on("click", this.restore.bind(this));
        (0, mdui_1.$)(this.titleBar.querySelector('mdui-button-icon[name="close"]')).on("click", this.close.bind(this));
        const hands = this.div.querySelector(".hands");
        for (let i = 1; i <= 9; i++) {
            if (i == 5)
                continue;
            //@ts-ignore
            (0, mdui_1.$)(hands.querySelector(".i" + i)).on("pointerdown", this.onwinresizestart.bind(this));
        }
        this.state = state;
        this.content = this.div.querySelector(".content");
        this.content.focus();
        (0, mdui_1.$)(this.content).on("load", () => {
            const win = this.content.contentWindow;
            if (!win)
                return;
            win.addEventListener("focus", () => { this.activate(); });
            for (const evtN of ["keydown", "keyup"]) {
                win.addEventListener(evtN, (evt) => {
                    this.div.dispatchEvent(copyKbdEvent(evt));
                });
            }
            // win.pkUpdateTitle = () => {};
        });
        this.$div.one("animationend", () => { this.$div.removeClass("opening"); });
        this.$div.addClass("pkWindow opening");
    }
    set title(v) {
        this.titleBarTitle.innerHTML = this._title = v;
    }
    get title() {
        return this._title;
    }
    onwindragstart(evt) {
        evt.preventDefault();
        if (evt.button != 0)
            return;
        if (this.titleLastClick < 0) {
            this.titleLastClick = performance.now();
        }
        this.dragOffsetX = evt.clientX - this.x;
        this.dragOffsetY = evt.clientY - this.y;
        this.wm.addPtrEventListener("pointerup", this.dragStopHand);
        this.wm.addPtrEventListener("pointerleave", this.dragStopHand);
        this.wm.addPtrEventListener("pointermove", this.dragMoveHand);
    }
    onwindragstop(evt) {
        evt.preventDefault();
        if (this.titleLastClick >= 0) {
            const d = performance.now() - this.titleLastClick;
            if (d <= 600) {
                if (++this.titleClickCnt >= 2) {
                    this.titleLastClick = -1;
                    this.titleClickCnt = 0;
                    this.maxBtn();
                }
            }
            else {
                this.titleLastClick = -1;
                this.titleClickCnt = 0;
            }
        }
        this.wm.removePtrEventListener("pointermove", this.dragMoveHand);
        this.wm.removePtrEventListener("pointerleave", this.dragStopHand);
        this.wm.removePtrEventListener("pointerup", this.dragStopHand);
    }
    onwindragmove(evt) {
        evt.preventDefault();
        this.titleLastClick = -1;
        this.titleClickCnt = 0;
        if (this.state & WS_MAXIMIZED)
            return;
        this.x = evt.clientX - this.dragOffsetX;
        if (evt.clientY < this.wm.y + this.wm.height) {
            this.y = evt.clientY - this.dragOffsetY;
        }
    }
    onwinresizestart(evt) {
        evt.preventDefault();
        if (evt.button != 0)
            return;
        const target = evt.target;
        this.wm.lockCursor(getComputedStyle(target).cursor);
        this.activeHand = Number(target.className[1]);
        this.dragOffsetX = evt.clientX - this.x;
        this.dragOffsetY = evt.clientY - this.y;
        this.origX2 = this.x + this.width;
        this.origY2 = this.y + this.height;
        this.wm.addPtrEventListener("pointerup", this.resizeStopHand);
        this.wm.addPtrEventListener("pointerleave", this.resizeStopHand);
        this.wm.addPtrEventListener("pointermove", this.resizeMoveHand);
    }
    onwinresizestop(evt) {
        evt.preventDefault();
        this.wm.lockCursor(null);
        this.wm.removePtrEventListener("pointermove", this.resizeMoveHand);
        this.wm.removePtrEventListener("pointerleave", this.resizeStopHand);
        this.wm.removePtrEventListener("pointerup", this.resizeStopHand);
    }
    onwinresizemove(evt) {
        evt.preventDefault();
        const minWidth = 200;
        const minHeight = parseFloat(getComputedStyle(this.titleBar).height);
        const i = this.activeHand;
        if (i % 3 == 1) {
            const newWidth = this.origX2 - evt.clientX + this.dragOffsetX;
            if (newWidth > minWidth && evt.clientX >= this.wm.x) {
                this.x = evt.clientX - this.dragOffsetX;
                this.width = newWidth;
            }
        }
        else if (i % 3 == 0) {
            const newWidth = evt.clientX - this.x;
            if (newWidth > minWidth && evt.clientX < this.wm.x + this.wm.width) {
                this.width = newWidth;
            }
        }
        if (1 <= i && i <= 3) {
            const newHeight = this.origY2 - evt.clientY + this.dragOffsetY;
            if (newHeight > minHeight && evt.clientY >= this.wm.y) {
                this.y = evt.clientY - this.dragOffsetY;
                this.height = newHeight;
            }
        }
        else if (i >= 7) {
            const newHeight = evt.clientY - this.y;
            if (newHeight > minHeight && evt.clientY < this.wm.y + this.wm.height) {
                this.height = newHeight;
            }
        }
    }
    /* friend */ _close() {
        this.$div.on("animationend", () => {
            this.div.remove();
        });
        this.$div.addClass("closing");
    }
    /* friend */ _deactivate() {
        this.$div.removeClass("active");
    }
    /* friend */ _activate() {
        if (this.$div.hasClass("minimizedAni")) {
            requestAnimationFrame(() => { this.$div.removeClass("minimizedAni"); });
            this.$div.one("transitionend", () => {
                this.$div.removeClass("minimizing");
            });
        }
        this.$div.addClass("active");
    }
    _maximize() {
        (0, mdui_1.$)(this.maximizeBtn).hide();
        (0, mdui_1.$)(this.restoreBtn).show();
    }
    _restore() {
        (0, mdui_1.$)(this.maximizeBtn).show();
        (0, mdui_1.$)(this.restoreBtn).hide();
    }
    maximize() {
        this.$div.addClass("maximizing");
        super.maximize();
        this.$div.one("transitionend", () => {
            this.$div.removeClass("maximizing");
        });
    }
    restore() {
        this.$div.addClass("maximizing");
        super.restore();
        this.$div.one("transitionend", () => {
            this.$div.removeClass("maximizing");
        });
    }
    minimize() {
        this.$div.addClass("minimizing minimizedAni");
        this.$div.css("display", "block");
        super.minimize();
        this.$div.one("transitionend", () => {
            this.$div.css("display", "");
        });
    }
    maxBtn() {
        if (this.state & WS_MAXIMIZED) {
            this.restore();
        }
        else {
            this.maximize();
        }
    }
}
class Taskbar {
    constructor(wm, div) {
        this.btns = new Map();
        this.wm = wm;
        this.div = div;
        //@ts-ignore
        (0, mdui_1.$)(this.div).on("click", (evt) => {
            if (evt.target.tagName.toLowerCase() != "mdui-button-icon")
                WM.activate(null);
        });
        this.wm.style.height = "calc(100% - 3.5rem)";
        this.winList = this.div.querySelector("#windowList");
        for (const window of this.wm.getWindows()) {
            this.addWindow(window);
        }
        this.wm.addHook("bind", this.addWindow.bind(this));
        this.wm.addHook("close", this.removeWindow.bind(this));
        this.wm.addHook("activate", this.activateWindow.bind(this));
    }
    addWindow(window) {
        const btn = new mdui_1.ButtonIcon();
        btn.icon = "api";
        const $btn = (0, mdui_1.$)(btn);
        $btn.addClass("show active");
        const ani = () => {
            if (btn.offsetLeft)
                this.winList.scrollTo({ top: 0, left: btn.offsetLeft, behavior: "instant" });
            if ($btn.hasClass("show") && $btn.hasClass("active"))
                requestAnimationFrame(ani);
        };
        ani();
        $btn.one("animationend", () => {
            $btn.removeClass("show");
        });
        $btn.on("click", () => {
            if ($btn.hasClass("active")) {
                window.minimize();
            }
            else {
                window.activate();
            }
        });
        this.btns.set(window, btn);
        this.winList.appendChild(btn);
    }
    removeWindow(window) {
        const btn = (0, mdui_1.$)(this.btns.get(window));
        if (!btn)
            return;
        this.btns.delete(window);
        btn.on("animationend", () => {
            btn.remove();
        });
        btn.addClass("hide");
    }
    activateWindow(window) {
        (0, mdui_1.$)(this.winList.querySelectorAll(".active")).removeClass("active");
        if (!window)
            return;
        const btn = this.btns.get(window);
        if (!btn)
            return;
        (0, mdui_1.$)(btn).addClass("active");
        if (btn.offsetLeft > this.winList.scrollLeft + this.winList.clientWidth || btn.offsetLeft < this.winList.scrollLeft) {
            this.winList.scrollTo({ top: 0, left: btn.offsetLeft, behavior: "smooth" });
        }
    }
}
/* ========== DWM Demo ========== */
const SM = new SurfaceManager((0, mdui_1.$)("#screen")[0]);
const WM = new WindowManager(SM, (0, mdui_1.$)("#windows")[0]);
const window1 = new PkWindow(WM, 20, 20, 400, 300, "Window 1");
const window2 = new PkWindow(WM, 20, 20, 400, 300, "Window 1");
window2.title = "Window 2";
window2.x = 100;
window2.y = 100;
window2.width = 500;
window2.height = 400;
const taskbar = new Taskbar(WM, (0, mdui_1.$)("#taskbar")[0]);
const window3 = new PkWindow(WM, 300, 300, 400, 300, "Window 3");
let cnt = 1;
function randint(max) {
    return Math.floor(Math.random() * max);
}
(0, mdui_1.$)("#background").on("click", () => {
    new PkWindow(WM, randint(window.innerWidth - 300), randint(window.innerHeight - 100), 300, 200, "Demo " + cnt);
    cnt++;
});
document.body.addEventListener("keyup", (evt) => {
    if (evt.key == "Escape") {
        const windows = WM.getWindows();
        if (windows.length)
            WM.close(windows[windows.length - 1]);
    }
    else if (evt.key == " ") {
        (0, mdui_1.$)("#background")[0].click();
    }
});

import {$, ButtonIcon, JQ, Menu, TopAppBar, TopAppBarTitle} from 'mdui'

function containsOrEqual(parent: HTMLElement, child: HTMLElement) {
    return parent && child && (parent === child || $.contains(parent, child));
}

function copyKbdEvent(evt: KeyboardEvent) {
    const opts: {[key: string]: any} = {};
    for (const key in evt) {
        //@ts-ignore
        const value = evt[key];
        opts[key] = value;
    }
    const evt2 = new KeyboardEvent(evt.type, opts);
    return evt2;
}

$.extend({
    containsOrEqual: containsOrEqual
});

let activePopupCardBtn: JQ<HTMLElement> | null = null;
let activePopupCard: JQ<HTMLElement> | null = null;

function hidePopupCard() {
    activePopupCard && (activePopupCard.addClass("hidden"), activePopupCard.trigger("card-hide"));
    activePopupCardBtn && activePopupCardBtn.removeAttr("selected");
    activePopupCard = null;
    activePopupCardBtn = null;
}

$("#taskbar").on('change', (evt) => {
    const btn = evt.target as ButtonIcon;
    const toggle = $(btn.dataset.toggle);
    if (toggle) {
        if (btn.selected) {
            hidePopupCard();
            toggle.removeClass("hidden");
            activePopupCardBtn = $(btn);
            activePopupCard = toggle;
            activePopupCard.trigger("card-show");
        }
        else toggle.addClass("hidden");
    }
});

$("#screen").on("click", (evt) => {
    if (!activePopupCard || !activePopupCardBtn) return;
    const target = evt.target as HTMLElement;
    if (!containsOrEqual(activePopupCard.get(0), target)
                && !containsOrEqual(activePopupCardBtn.get(0), target)) {
        hidePopupCard();
    }
});

//@ts-ignore
$("#screen").on("keydown", (evt: KeyboardEvent) => {
    if (!activePopupCard || !activePopupCardBtn) return;
    const target = evt.target as HTMLElement;
    if (evt.key == "Escape"){
        evt.preventDefault();
        hidePopupCard();
    }
});

$("#launcher").on("card-show", ()=>{$("#search").val("")[0].focus()});


const WS_MINIMIZED   = 1 << 0;
const WS_MAXIMIZED = 1 << 1;

class SurfaceManager {
    protected screen: HTMLDivElement;
    protected ptrSurface: HTMLDivElement;
    protected evtListenerCnt: number = 0;

    // Exports
    public addEventListener: Function;
    public removeEventListener: Function;
    public dispatchEvent: Function;

    constructor(screen: HTMLDivElement) {
        this.screen = screen;
        this.ptrSurface = document.createElement("div");
        this.ptrSurface.className = "ptrSurface";
        this.ptrSurface.style.display = "none";
        this.screen.appendChild(this.ptrSurface);
        this.addEventListener = this.screen.addEventListener.bind(this.screen);
        this.removeEventListener = this.screen.removeEventListener.bind(this.screen);
        this.dispatchEvent = this.screen.dispatchEvent.bind(this.screen);
    }

    public addPtrEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLDivElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        this.evtListenerCnt++;
        if (this.evtListenerCnt) {
            this.ptrSurface.style.display = "";
        }
        this.ptrSurface.addEventListener(type, listener, options);
    }

    public removePtrEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLDivElement, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        this.ptrSurface.removeEventListener(type, listener, options);
        this.evtListenerCnt--;
        if (!this.evtListenerCnt) {
            this.ptrSurface.style.display = "none";
        }
    }

    public lockCursor(cursor: CSSStyleDeclaration["cursor"] | null) {
        this.ptrSurface.style.cursor = cursor || "";
    }
}

class WindowManager {
    protected sm: SurfaceManager;

    protected windows: BaseWindow[] = [];
    protected windowEl: HTMLDivElement;
    protected hooks: { [key: string]: Function[] } = {};
    protected lastNoActive: boolean = true;

    // Exports
    public addEventListener: Function;
    public removeEventListener: Function;
    public addPtrEventListener: Function;
    public removePtrEventListener: Function;
    public lockCursor: Function;
    public dispatchEvent: Function;

    constructor(sm: SurfaceManager, windowEl: HTMLDivElement) {
        this.sm = sm;
        this.windowEl = windowEl;
        this.addEventListener = this.windowEl.addEventListener.bind(this.windowEl);
        this.removeEventListener = this.windowEl.removeEventListener.bind(this.windowEl);
        this.addPtrEventListener = this.sm.addPtrEventListener.bind(this.sm);
        this.removePtrEventListener = this.sm.removePtrEventListener.bind(this.sm);
        this.lockCursor = this.sm.lockCursor.bind(this.sm);
        this.dispatchEvent = this.windowEl.dispatchEvent.bind(this.windowEl);
    }

    public lenWindows() {
        return this.windows.length;
    }

    public getWindows(): readonly BaseWindow[]{
        return [...this.windows];
    }

    /* friend */ public addHook(target: string, hook: Function) {
        if (!this.hooks[target]) this.hooks[target] = [];
        this.hooks[target].push(hook);
    }

    /* friend */ public removeHook(target: string, hook: Function) {
        if (!this.hooks[target] || !this.hooks[target].includes(hook)) {
            throw new Error("Target not found");
        }
        this.hooks[target].splice(this.hooks[target].indexOf(hook), 1);
    }

    private getHooks(target: string) {
        return this.hooks[target] || [];
    }

    public bind(window: BaseWindow, div: HTMLElement) {
        this.windowEl.appendChild(div);
        this.activate(null);
        this.windows.push(window);
        for (const hookFunc of this.getHooks("bind")) {
            hookFunc(window);
        }
        this.activate(window);
    }

    private findWindowIdx(window: BaseWindow) {
        return this.windows.indexOf(window);
    }

    private findWindowIdxA(window: BaseWindow) {
        const idx = this.windows.indexOf(window);
        if (idx == -1) throw new Error("Window not found");
        return idx;
    }

    public close(window: BaseWindow) {
        const idx = this.findWindowIdxA(window);
        this.windows.splice(idx, 1);
        window._close();
        if (!this.lastNoActive && this.windows.length) {
            this.activate(this.windows[idx-1]);
        }
        else {
            this.activate(null);
        }
        for (const hookFunc of this.getHooks("close")) {
            hookFunc(window);
        }
    }

    public activate(window: BaseWindow | null) {
        if (!window) {
            if (this.windows.length && !this.lastNoActive) this.windows[this.windows.length-1]._deactivate();
            this.lastNoActive = true;
            for (const hookFunc of this.getHooks("activate")) {
                hookFunc(null);
            }
            return;
        }
        const idx = this.findWindowIdx(window);
        if (idx == -1) return;
        if (idx != this.windows.length-1) this.windows[this.windows.length-1]._deactivate();
        this.lastNoActive = false;
        const zIdx = window.zIndex;
        if (zIdx <= 0) return;
        for (const w of this.windows) {
            if (w.zIndex > zIdx && w.zIndex <= this.windows.length) w.zIndex--;
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

    public deactivate(window: BaseWindow) {
        const idx = this.findWindowIdxA(window);
        if (!this.lastNoActive && this.windows.length) {
            for (let i = idx-1; i >= 0; i--) {
                if (! (this.windows[i].state & WS_MINIMIZED)) {
                    this.activate(this.windows[i]);
                    return;
                }
            }
        }
        this.activate(null);
    }

    /* friend */ public get style() : CSSStyleDeclaration {
        return this.windowEl.style;
    }

    public get x() : number {
        return this.windowEl.clientLeft;
    }
    
    public get y() : number {
        return this.windowEl.clientTop;
    }
    
    public get width() : number {
        return this.windowEl.clientWidth;
    }
    
    public get height() : number {
        return this.windowEl.clientHeight;
    }    
}

class BaseWindow {
    protected wm: WindowManager

    protected _x: number = 0
    protected _y: number = 0
    protected _state: number = 0;
    protected _width: number = 0;
    protected _height: number = 0;
    protected _title: string = "";
    protected _zIndex: number = 0;
    protected div: HTMLDivElement;
    protected $div: JQ<HTMLDivElement>;

    public activate: Function;
    public deactivate: Function;
    public close: Function;

    constructor(wm: WindowManager, x=20, y=20, width=100, height=100, title="", state=0){
        this.wm = wm;
        this.activate = this.wm.activate.bind(this.wm, this);
        this.deactivate = this.wm.deactivate.bind(this.wm, this);
        this.close = this.wm.close.bind(this.wm, this);

        this.div = document.createElement("div");
        this.$div = $(this.div);
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

    public get x() : number {
        return this._x;
    }
    
    public set x(v : number) {
        this._x = v;
        this.div.style.left = v+"px";
    }
    
    public get y() : number {
        return this._y;
    }
    
    public set y(v : number) {
        this._y = v;
        this.div.style.top = v+"px";
    }

    public get state() : number {
        return this._state;
    }

    public set state(v : number) {
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
    
    public get width() : number {
        return this._width;
    }

    public set width(v : number) {
        this._width = v;
        this.div.style.width = v+"px";
    }

    public get height() : number {
        return this._height;
    }

    public set height(v : number) {
        this._height = v;
        this.div.style.height = v+"px";
    }

    public get title() : string {
        return this._title;
    }

    public set title(v : string) {
        this._title = v;
    }

    public get zIndex() : number {
        return this._zIndex;
    }

    /* friend */ public set zIndex(v : number) {
        this._zIndex = v;
        this.div.style.zIndex = v.toString();
    }

    /* friend */ public _close() {
        this.div.remove();
    }

    protected _maximize() {
        // TODO:
    }

    protected _restore() {
        // TODO:
    }

    /* friend */ public _deactivate() {
        // TODO: Dispatch event
    }

    /* friend */ public _activate() {
        // TODO: Dispatch event
    }

    public maximize() {
        this.state |= WS_MAXIMIZED;
    }

    public restore() {
        this.state &= ~WS_MAXIMIZED;
    }

    public minimize() {
        this.state |= WS_MINIMIZED;
    }
}

class PkWindow extends BaseWindow {
    protected titleBar: TopAppBar;
    protected titleBarTitle: TopAppBarTitle;
    protected content: HTMLIFrameElement;
    protected dragOffsetX: number = 0;
    protected dragOffsetY: number = 0;
    protected dragStopHand = this.onwindragstop.bind(this);
    protected dragMoveHand = this.onwindragmove.bind(this);
    protected origX2: number = 0;
    protected origY2: number = 0;
    protected resizeStopHand = this.onwinresizestop.bind(this);
    protected resizeMoveHand = this.onwinresizemove.bind(this);
    protected maximizeBtn: ButtonIcon;
    protected restoreBtn: ButtonIcon;
    protected activeHand: number = 0;
    protected titleLastClick: number = -1;
    protected titleClickCnt: number = 0;

    constructor(
            dm: WindowManager,
            x=20, y=20, width=400, height=300,
            title="", state=0
        ){
        super(dm, x, y, width, height, title, state);
        this.$div = $(this.div);
        this.$div.addClass("pkWindow");
        const template = ($("#pkWindowTemplate")[0] as HTMLTemplateElement).content
        this.div.appendChild(document.importNode(template, true));
        this.titleBar = this.div.querySelector("mdui-top-app-bar") as TopAppBar;
        this.titleBarTitle = this.titleBar.querySelector("mdui-top-app-bar-title") as TopAppBarTitle
        this.title = title;
        this.titleBarTitle.addEventListener("pointerdown", this.onwindragstart.bind(this));
        $(this.titleBar.querySelector('mdui-button-icon[name="minimize"]')).on("click", this.minimize.bind(this));
        this.maximizeBtn = this.titleBar.querySelector('mdui-button-icon[name="maximize"]') as ButtonIcon;
        $(this.maximizeBtn).on("click", this.maximize.bind(this));
        this.restoreBtn = this.titleBar.querySelector('mdui-button-icon[name="restore"]') as ButtonIcon;
        $(this.restoreBtn).on("click", this.restore.bind(this));
        $(this.titleBar.querySelector('mdui-button-icon[name="close"]')).on("click", this.close.bind(this));
        const hands = this.div.querySelector(".hands") as HTMLDivElement;
        for (let i = 1; i <= 9; i++) {
            if (i == 5) continue;
            //@ts-ignore
            $(hands.querySelector(".i"+i)).on("pointerdown", this.onwinresizestart.bind(this));
        }
        this.state = state;

        this.content = this.div.querySelector(".content") as HTMLIFrameElement;
        this.content.focus();
        $(this.content).on("load", () => {
            const win = this.content.contentWindow;
            if (!win) return;
            win.addEventListener("focus", ()=>{this.activate()});
            for (const evtN of ["keydown", "keyup"]) {
                win.addEventListener(evtN, (evt) => {
                    this.div.dispatchEvent(copyKbdEvent(evt as KeyboardEvent));
                });
            }
            // win.pkUpdateTitle = () => {};
        })

        this.$div.one("animationend", () => {this.$div.removeClass("opening")});
        this.$div.addClass("pkWindow opening");
    }

    public set title(v : string) {
        this.titleBarTitle.innerHTML = this._title = v;
    }

    public get title() : string {
        return this._title;
    }

    protected onwindragstart(evt: MouseEvent) {
        evt.preventDefault();
        if (evt.button != 0) return;
        if (this.titleLastClick < 0) {
            this.titleLastClick = performance.now();
        }
        this.dragOffsetX = evt.clientX - this.x;
        this.dragOffsetY = evt.clientY - this.y;
        this.wm.addPtrEventListener("pointerup", this.dragStopHand);
        this.wm.addPtrEventListener("pointerleave", this.dragStopHand);
        this.wm.addPtrEventListener("pointermove", this.dragMoveHand);
    }

    protected onwindragstop(evt: MouseEvent) {
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

    protected onwindragmove(evt: MouseEvent) {
        evt.preventDefault();
        this.titleLastClick = -1;
        this.titleClickCnt = 0;
        if (this.state & WS_MAXIMIZED) return;
        this.x = evt.clientX - this.dragOffsetX;
        if (evt.clientY < this.wm.y + this.wm.height) {
            this.y = evt.clientY - this.dragOffsetY;
        }
    }

    protected onwinresizestart(evt: MouseEvent) {
        evt.preventDefault();
        if (evt.button != 0) return;
        const target = evt.target as HTMLDivElement;
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

    protected onwinresizestop(evt: MouseEvent) {
        evt.preventDefault();
        this.wm.lockCursor(null);
        this.wm.removePtrEventListener("pointermove", this.resizeMoveHand);
        this.wm.removePtrEventListener("pointerleave", this.resizeStopHand);
        this.wm.removePtrEventListener("pointerup", this.resizeStopHand);
    }

    protected onwinresizemove(evt: MouseEvent) {
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

    /* friend */ public _close() {
        this.$div.on("animationend", () => {
            this.div.remove();
        });
        this.$div.addClass("closing");
    }

    /* friend */ public _deactivate() {
        this.$div.removeClass("active");
    }

    /* friend */ public _activate() {
        if (this.$div.hasClass("minimizedAni")) {
            requestAnimationFrame(()=>{this.$div.removeClass("minimizedAni")});
            this.$div.one("transitionend", () => {
                this.$div.removeClass("minimizing");
            });
        }
        this.$div.addClass("active");
    }

    protected _maximize() {
        $(this.maximizeBtn).hide();
        $(this.restoreBtn).show();
    }

    protected _restore() {
        $(this.maximizeBtn).show();
        $(this.restoreBtn).hide();
    }

    public maximize() {
        this.$div.addClass("maximizing");
        super.maximize();
        this.$div.one("transitionend", () => {
            this.$div.removeClass("maximizing");
        });
    }

    public restore() {
        this.$div.addClass("maximizing");
        super.restore();
        this.$div.one("transitionend", () => {
            this.$div.removeClass("maximizing");
        });
    }

    public minimize() {
        this.$div.addClass("minimizing minimizedAni");
        this.$div.css("display", "block");
        super.minimize();
        this.$div.one("transitionend", () => {
            this.$div.css("display", "");
        });
    }

    private maxBtn() {
        if (this.state & WS_MAXIMIZED) {
            this.restore();
        }
        else {
            this.maximize();
        }
    }
}

class Taskbar {
    protected wm: WindowManager;
    protected div: HTMLDivElement;
    protected winList: HTMLDivElement;
    protected btns: Map<BaseWindow, ButtonIcon> = new Map();

    constructor(wm: WindowManager, div: HTMLDivElement) {
        this.wm = wm;
        this.div = div;
        //@ts-ignore
        $(this.div).on("click", (evt: MouseEvent) => {
            if ((evt.target as HTMLElement).tagName.toLowerCase() != "mdui-button-icon")
            WM.activate(null);
        });
        this.wm.style.height = "calc(100% - 3.5rem)";
        this.winList = this.div.querySelector("#windowList") as HTMLDivElement;
        for (const window of this.wm.getWindows()) {
            this.addWindow(window);
        }
        this.wm.addHook("bind", this.addWindow.bind(this));
        this.wm.addHook("close", this.removeWindow.bind(this));
        this.wm.addHook("activate", this.activateWindow.bind(this));
    }

    protected addWindow(window: BaseWindow) {
        const btn = new ButtonIcon();
        btn.icon = "api";
        const $btn = $(btn);
        $btn.addClass("show active");
        const ani = () => {
            if (btn.offsetLeft) this.winList.scrollTo({ top: 0, left: btn.offsetLeft, behavior: "instant" })
            if ($btn.hasClass("show") && $btn.hasClass("active")) requestAnimationFrame(ani);
        }
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
        })
        this.btns.set(window, btn);
        this.winList.appendChild(btn);
    }

    protected removeWindow(window: BaseWindow) {
        const btn = $(this.btns.get(window));
        if (!btn) return;
        this.btns.delete(window);
        btn.on("animationend", () => {
            btn.remove();
        })
        btn.addClass("hide");
    }

    protected activateWindow(window: BaseWindow | null) {
        $(this.winList.querySelectorAll(".active")).removeClass("active");
        if (!window) return;
        const btn = this.btns.get(window);
        if (!btn) return;
        $(btn).addClass("active");
        if (btn.offsetLeft > this.winList.scrollLeft + this.winList.clientWidth || btn.offsetLeft < this.winList.scrollLeft) {
            this.winList.scrollTo({ top: 0, left: btn.offsetLeft, behavior: "smooth" })
        }
    }
}


/* ========== DWM Demo ========== */
const SM = new SurfaceManager($("#screen")[0] as HTMLDivElement);
const WM = new WindowManager(SM, $("#windows")[0] as HTMLDivElement);
const window1 = new PkWindow(WM, 20, 20, 400, 300, "Window 1");
const window2 = new PkWindow(WM, 20, 20, 400, 300, "Window 1");
window2.title = "Window 2";
window2.x = 100;
window2.y = 100;
window2.width = 500;
window2.height = 400;
const taskbar = new Taskbar(WM, $("#taskbar")[0] as HTMLDivElement);
const window3 = new PkWindow(WM, 300, 300, 400, 300, "Window 3");

let cnt=1;
function randint(max: number) {
    return Math.floor(Math.random() * max);
}
$("#background").on("click", () => {
    new PkWindow(WM, randint(window.innerWidth-300), randint(window.innerHeight-100), 300, 200, "Demo "+cnt);
    cnt++;
});
document.body.addEventListener("keyup", (evt: KeyboardEvent) => {
    if (evt.key == "Escape") {
        const windows = WM.getWindows();
        if (windows.length) WM.close(windows[windows.length-1]);
    }
    else if (evt.key == " ") {
        $("#background")[0].click();
    }
});

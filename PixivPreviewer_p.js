// ==UserScript==
// @name               Pixiv预览器（轻量级）
// @name:en            PixivPreviewer(Light)
// @namespace          https://greasyfork.org/zh-CN/users/866669-shikataganai
// @author             shikataganai
// @version            1.03
// @description        Pixiv 插画预览器（轻量级），可快速预览单图、多图、动图，支持快捷键旋转图片、翻页、GIF暂停、GIF逐帧翻页、复制图片ID等
// @description:en     Pixiv image previewer (Light), Quick preview single, multiple, and GIF, Support shortcut keys to rotate images, flip pages, pause GIFs, flip GIFs frame by frame, copy image IDs, etc
// @license            MIT
// @supportURL         https://github.com/kuroChef/PixivPreviewer
// @icon               https://www.pixiv.net/favicon.ico
// @match              https://www.pixiv.net/*
// ==/UserScript==

/* 6.32->1.03
用于Pixiv的轻量级插画预览器。

快捷键：
- alt+z 开关预览
- alt+c 悬停时复制插画PID
- qQeE 旋转图片
- aA← 上一页
- dD→ 下一页
- sS 暂停/播放GIF
*/

class QPreviewer {
    distanceRate = .95;
    distanceMinValue = 20;
    imgSize = ["360x360_70", "240x480", "600x600"];
    curImgSize = this.imgSize[2];
    RE_FullDTWithPID = /\d{4}\/\d{2}\/\d{2}\/\d{2}\/\d{2}\/\d{2}\/\d{7,}/;
    RE_PID = /\d{7,}/;
    illustrationURL_head = `https://i.pximg.net/c/${this.curImgSize}/img-master/img/`;
    frameURL_head = "https://i.pximg.net/img-original/img/";
    gifLoadLimit = 0;
    themeBgColor = "rgba(0,151,249,0.1)";
    loadedBgColor = "rgba(0, 0, 0, 0.1)";
    normalCardStyle = "border-radius: 8px;background-color:" + this.themeBgColor;
    smallArtCartStyle = "border-bottom: 2px solid rgba(0,151,249,0.5);";
    offDisplay = !1;
    eleProp_imgProcessed = "qp_imgProcessed";
    eleProp_imgInfo = "qp_imgInfo";
    eleProp_originImg = "qp_originImg";
    imgClassMap = {
        "sc-rp5asc-10 jBxEmj": [this.normalCardStyle, [6], t => "sc-rp5asc-0 fxGQTu" === this.getParent(t, 4).getAttribute("class") ? this.getParent(t, 8) : "sc-rp5asc-0 fuLEV" === this.getParent(t, 4).getAttribute("class") ? this.getRelativePathElement(t, [7, -1]) : t],
        "sc-rp5asc-10 hOyrZP": [this.normalCardStyle, [6]],
        "sc-rp5asc-10 joKryv": [this.normalCardStyle, [9]],
        "sc-rp5asc-10 dLfLDP": [this.smallArtCartStyle, [7]],
        "sc-1b4yl3n-2 hgPJLQ": [this.smallArtCartStyle, [2], t => this.getParent(t, 3)],
        "sc-7bef31-2 gszsZT": [this.normalCardStyle, [3]],
        "sc-8cc0a8e6-3 dwRUmP": [this.normalCardStyle, [6]]
    };
    curImgInfo = null;
    curPage = 0;
    curGIFShow = !1;
    curGIFPause = !1;
    gifInfo = {};
    curImgLoaded = !1;
    checkLoadImg;
    imgDisplayDiv;
    imgShower;
    imgShowerRotateDeg = 0;
    imgInfoDiv;

    constructor() {
        this.checkLoadImg = document.createElement("img"), this.imgDisplayDiv = document.createElement("div"), this.imgDisplayDiv.style = "display:none;position:fixed;top:0px;Height:100vh;z-index:100;transition:background-color 0.5s ease-in-out 0s;text-align:center;", this.imgShower = document.createElement("img"), this.imgDisplayDiv.appendChild(this.imgShower), this.imgShower.style = "max-width:100%;height:100%;object-fit:contain;transform-origin:center;", document.body.appendChild(this.imgDisplayDiv), this.imgInfoDiv = document.createElement("div"), this.imgInfoDiv.style = "color:#fff;font-size:12px;text-align:center;padding:5px;position:absolute;top:10px;background-color:rgba(0,151,249,0.6);border-radius:10px;z-index:101;", this.imgDisplayDiv.appendChild(this.imgInfoDiv), this.initImgInfoDiv(this.imgInfoDiv), this.checkLoadImg.cbParent = this, this.checkLoadImg.addEventListener("load", this.onImgLoadCB), this.checkLoadImg.addEventListener("error", this.onImgErrorCB), document.addEventListener("keydown", this.hotKeyCB), new MutationObserver((t => {
            for (let i of t) {
                let t = i.target.children;
                if (t) for (let i = 0; i < t.length; i++) "IMG" === t[i].tagName && this.checkImgClass(t[i]) && this.processImg(t[i])
            }
        })).observe(document.body, {attributes: !1, childList: !0, subtree: !0})
    }

    onImgLoadCB = () => {
        this.curImgInfo && (this.curImgLoaded = !0, this.rotateImgShower(0), this.curGIFShow || (this.curImgInfo.isGIF && !this.gifInfo[this.curImgInfo.PID].ok ? (this.gifInfo[this.curImgInfo.PID].framePostfixChecked = !0, this.preloadGIF()) : this.imgDisplayDiv.style.backgroundColor = this.loadedBgColor))
    };
    onImgErrorCB = () => {
        if (!this.curImgInfo) return;
        let t = this.curImgInfo.PID;
        this.curImgInfo.isGIF && !this.gifInfo[t].framePostfixChecked && ("jpg" === this.gifInfo[t].framePostfix ? this.gifInfo[t].framePostfix = "png" : this.gifInfo[t].framePostfix = "jpg", this.imgDisplay())
    };
    hotKeyCB = t => {
        if ("Escape" !== t.key) if (!t.altKey || "z" !== t.key && "Z" !== t.key) {
            if (this.curImgInfo) if (!t.altKey || "c" !== t.key && "C" !== t.key) {
                if ("q" === t.key || "Q" === t.key ? this.rotateImgShower(90) : "e" !== t.key && "E" !== t.key || this.rotateImgShower(-90), this.curImgInfo.pageAmount > 1) {
                    if (!this.curImgInfo.isGIF || "s" !== t.key && "S" !== t.key || (this.curGIFPause ? (this.curGIFPause = !1, this.playGIF()) : this.curGIFPause = !0, this.updateGIFInfo()), this.curGIFShow && !this.curGIFPause) return;
                    "a" === t.key || "ArrowLeft" === t.key || "A" === t.key ? (this.imgDisplayDiv.style.backgroundColor = this.themeBgColor, this.curPage <= 0 ? this.curPage = this.curImgInfo.pageAmount - 1 : this.curPage--, this.imgDisplay()) : "d" !== t.key && "ArrowRight" !== t.key && "D" !== t.key || (this.imgDisplayDiv.style.backgroundColor = this.themeBgColor, this.curPage >= this.curImgInfo.pageAmount - 1 ? this.curPage = 0 : this.curPage++, this.imgDisplay())
                }
            } else navigator.clipboard.writeText(this.curImgInfo.PID)
        } else this.offDisplay ? (this.offDisplay = !1, this.processAllTargetImgList()) : (this.clearImgDisplay(), this.offDisplay = !0); else this.clearImgDisplay(!0)
    };

    initImgInfoDiv(t) {
        t.span_imgPID = document.createElement("span"), t.span_imgPG = document.createElement("span"), t.span_imgGIF = document.createElement("span"), t.span_imgDT = document.createElement("span"), t.appendChild(t.span_imgPID), t.appendChild(t.span_imgPG), t.appendChild(t.span_imgGIF), t.appendChild(document.createElement("br")), t.appendChild(t.span_imgDT)
    }

    setImgInfoDiv(t = null, i = null, e = null, s = null) {
        null !== t && (this.imgInfoDiv.span_imgPID.innerText = t), null !== i && (this.imgInfoDiv.span_imgPG.innerText = i), null !== e && (this.imgInfoDiv.span_imgGIF.innerText = e), null !== s && (this.imgInfoDiv.span_imgDT.innerText = s)
    }

    checkImgClass(t) {
        return t.getAttribute("class") in this.imgClassMap
    }

    processAllTargetImgList() {
        let t = document.querySelectorAll("img");
        for (let i = 0; i < t.length; i++) this.checkImgClass(t[i]) && this.processImg(t[i])
    }

    processImg(t) {
        if (this.offDisplay) return;
        if (t[this.eleProp_imgProcessed]) return;
        let i;
        t[this.eleProp_imgProcessed] = !0, this.setImgBg(t);
        let e = this.imgClassMap[t.getAttribute("class")][2];
        i = e ? e(t) : t, i[this.eleProp_originImg] = t, i.addEventListener("mouseover", this.setImgShower), i.addEventListener("mousemove", this.setImgDisplayPosition), i.addEventListener("mouseout", this.clearImgDisplay), i.addEventListener("click", this.clearImgDisplay), this.imgDisplayDiv.addEventListener("mousemove", this.clearImgDisplay)
    }

    setImgShower = t => {
        if (this.offDisplay || this.curImgInfo) return;
        let i = t.target[this.eleProp_originImg];
        i && (this.curImgInfo = this.getImgInfo(i), void 0 === this.curImgInfo && (this.extractImgInfo(i), this.curImgInfo = this.getImgInfo(i)), this.imgDisplayDiv.style.display = "block", this.setImgInfoDiv(this.curImgInfo.PID, null, null, this.curImgInfo.DTP.split("/", 3).join("-")), 0 !== this.curImgInfo.pageAmount ? (this.curImgInfo.pageAmount > 1 && this.updatePGInfo(), this.imgDisplay(), this.setImgDisplayPosition(t)) : this.getGIFFrames(i))
    };

    getImgPageAmount(t) {
        let i = this.getParent(t, 3), e = i.querySelector("svg.sc-14heosd-1.fArvVr");
        return e ? Number(this.getRelativePathElement(e, [3, -2]).textContent) : i.querySelector("svg.sc-192k5ld-0.etaMpt.sc-rp5asc-8.kSDUsv") ? 0 : 1
    }

    extractImgInfo(t) {
        let i = 0, e = this.getImgPageAmount(t);
        e || (i = 1);
        let s = {PID: this.RE_PID.exec(t.src)[0], DTP: this.RE_FullDTWithPID.exec(t.src)[0], isGIF: i, pageAmount: e};
        this.setImgInfo(t, s)
    }

    setImgInfo(t, i) {
        t[this.eleProp_imgInfo] = i
    }

    getImgInfo(t) {
        return t[this.eleProp_imgInfo]
    }

    setImgBg(t) {
        let i = this.imgClassMap[t.getAttribute("class")];
        i[0] && (this.getRelativePathElement(t, i[1]).style = i[0])
    }

    imgDisplay() {
        if (!this.curImgInfo) return;
        let t;
        if (this.updatePGInfo(), this.curImgInfo.isGIF) {
            if (t = `${this.frameURL_head}${this.curImgInfo.DTP}_ugoira${this.curPage}.${this.gifInfo[this.curImgInfo.PID].framePostfix}`, this.gifInfo[this.curImgInfo.PID].ok && !this.curGIFShow && !this.curGIFPause) return void this.playGIF()
        } else t = this.illustrationURL_head + `${this.curImgInfo.DTP}_p${this.curPage}_master1200.jpg`, this.imgDisplayDiv.style.backgroundColor = this.themeBgColor;
        this.curImgLoaded = !1, this.checkLoadImg.src = t, this.imgShower.src = t
    }

    clearImgDisplay = t => {
        this.rotateImgShower(), this.curPage = 0, this.curGIFShow = !1, this.curGIFPause = !1, this.curImgLoaded = !1, this.curImgInfo = null, this.resetImgShowerScale(), this.imgShower.src = "", this.checkLoadImg.src = "", this.imgDisplayDiv.style.display = "none", this.setImgInfoDiv("", "", "", "")
    };
    setImgDisplayPosition = t => {
        let i = t.clientX, e = document.documentElement.clientWidth;
        i >= e / 2 ? (i - i * this.distanceRate < this.distanceMinValue ? this.imgDisplayDiv.style.width = i - this.distanceMinValue + "px" : this.imgDisplayDiv.style.width = i * this.distanceRate + "px", this.imgDisplayDiv.style.left = "0px", this.imgDisplayDiv.style.right = "", this.imgInfoDiv.style.left = "10px", this.imgInfoDiv.style.right = "") : (e - i - (e - i) * this.distanceRate < this.distanceMinValue ? this.imgDisplayDiv.style.width = e - i - this.distanceMinValue + "px" : this.imgDisplayDiv.style.width = (e - i) * this.distanceRate + "px", this.imgDisplayDiv.style.left = "", this.imgDisplayDiv.style.right = "0px", this.imgInfoDiv.style.right = "10px", this.imgInfoDiv.style.left = ""), this.setImgShowerScale()
    };

    rotateImgShower(t) {
        if (void 0 === t) this.imgShowerRotateDeg = 0, this.imgShower.style.rotate = "0deg"; else {
            if (!this.curImgLoaded) return;
            this.imgShowerRotateDeg += t, this.imgShower.style.rotate = `${this.imgShowerRotateDeg}deg`, this.imgShowerRotateDeg % 180 ? this.setImgShowerScale() : this.resetImgShowerScale()
        }
    }

    resetImgShowerScale() {
        this.imgShower.style.scale = "", this.imgShower.style.translate = "", this.imgShower.style.height = "100%", this.imgShower.style.maxWidth = "100%"
    }

    setImgShowerScale() {
        if (!(this.curImgLoaded && this.imgShowerRotateDeg % 180)) return;
        let t, i = this.imgDisplayDiv.clientWidth, e = this.imgDisplayDiv.clientHeight, s = this.imgShower.naturalWidth,
            o = this.imgShower.naturalHeight;
        t = i / e <= o / s ? i / o : e / s;
        let r = 0;
        s > i && (r = (i - s) / 2), this.imgShower.style.translate = `${r}px ${(e - o) / 2}px`, this.imgShower.style.maxWidth = "", this.imgShower.style.height = "", this.imgShower.style.scale = t
    }

    updatePGInfo() {
        if (1 === this.curImgInfo.pageAmount) return;
        let t = ` | ${this.curPage + 1}/${this.curImgInfo.pageAmount}`;
        this.curImgInfo.isGIF && this.gifInfo[this.curImgInfo.PID].framesAmount > this.curImgInfo.pageAmount && (t += `(${this.gifInfo[this.curImgInfo.PID].framesAmount})`), this.setImgInfoDiv(null, t, null, null)
    }

    updateGIFInfo() {
        this.curImgInfo?.isGIF && (this.gifInfo[this.curImgInfo.PID].ok ? this.curGIFPause ? this.setImgInfoDiv(null, null, " ▶", null) : this.setImgInfoDiv(null, null, " ∥", null) : this.setImgInfoDiv(null, null, ` ${Math.round(this.gifInfo[this.curImgInfo.PID].loadedCount / this.gifInfo[this.curImgInfo.PID].framesLimit * 100)}%(${this.gifInfo[this.curImgInfo.PID].loadedCount})`, null))
    }

    getGIFFrames(t) {
        let i = this.getImgInfo(t);
        if (!i.isGIF || i.PID in this.gifInfo) return;
        let e = new XMLHttpRequest;
        e.open("get", `https://www.pixiv.net/ajax/illust/${i.PID}/ugoira_meta`, !0), e.onreadystatechange = () => {
            if (200 === e.status && e.responseText && !(i.PID in this.gifInfo)) {
                let s = JSON.parse(e.responseText).body.frames;
                this.gifInfo[i.PID] = {
                    frames: s,
                    framesAmount: s.length,
                    framesLimit: this.gifLoadLimit && this.gifLoadLimit < s.length ? this.gifLoadLimit : s.length,
                    framePostfix: "jpg",
                    framePostfixChecked: !1,
                    loaded: {},
                    loadedCount: 0,
                    ok: !1
                }, i.pageAmount = this.gifInfo[i.PID].framesLimit, this.setImgInfo(t, i), i.PID === this.curImgInfo?.PID && (this.curImgInfo = i, this.imgDisplay())
            } else 200 !== e.status && console.error(`[@Pixiv Script] get GIF failed, qPID: ${i.PID} cPID: ${this.curImgInfo.PID}\n${e}`)
        }, e.send()
    }

    preloadGIF() {
        let t = this.curImgInfo?.PID;
        if (!this.curImgInfo?.isGIF || !this.gifInfo[t].framePostfixChecked || this.gifInfo[t].ok) return;
        let i = this.curImgInfo.DTP, e = this.gifInfo[t].framePostfix;
        for (let s = 0; s < this.gifInfo[t].framesLimit && t === this.curImgInfo.PID; s++) {
            if (s in this.gifInfo[t].loaded) continue;
            let o = document.createElement("img");
            o.src = this.frameURL_head + `${i}_ugoira${s}.${e}`, o.addEventListener("load", (() => {
                this.gifInfo[t].loaded[s] = o, this.gifInfo[t].loadedCount++, this.gifInfo[t].loadedCount >= this.gifInfo[t].framesLimit && (this.imgDisplayDiv.style.backgroundColor = this.loadedBgColor, this.gifInfo[t].ok = !0, this.playGIF()), this.updateGIFInfo()
            }))
        }
    }

    async playGIF() {
        let t = this.curImgInfo?.PID;
        if (!this.curImgInfo?.isGIF || !this.gifInfo[t].ok || this.curGIFShow) return;
        let i = this.gifInfo[t].framesLimit;
        this.curGIFShow = !0, this.updateGIFInfo(), this.curPage === i - 1 && (this.curPage = 0);
        for (let e = this.curPage; e < i && (!this.curGIFPause && this.curGIFShow); e++) this.curPage = e, this.imgDisplay(), await this.sleep(Number(this.gifInfo[t].frames[e].delay));
        this.curGIFShow = !1, this.curGIFPause || this.playGIF()
    }

    sleep(t) {
        return new Promise((i => {
            setTimeout((() => {
                i()
            }), t)
        }))
    }

    getParent(t, i) {
        return i <= 0 ? t : this.getParent(t?.parentNode, --i)
    }

    getRelativePathElement(t, i) {
        let e = t;
        for (let t = 0; t < i.length; t++) i[t] > 0 ? e = this.getParent(e, i[t]) : i[t] < 0 && (e = e?.children[Math.abs(i[t]) - 1]);
        return e
    }
}

!function () {
    "use strict";
    new QPreviewer
}();
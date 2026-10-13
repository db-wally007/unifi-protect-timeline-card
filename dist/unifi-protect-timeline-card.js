/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const St = globalThis, Yt = St.ShadowRoot && (St.ShadyCSS === void 0 || St.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, Xt = Symbol(), re = /* @__PURE__ */ new WeakMap();
let Ve = class {
  constructor(t, i, s) {
    if (this._$cssResult$ = !0, s !== Xt) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = i;
  }
  get styleSheet() {
    let t = this.o;
    const i = this.t;
    if (Yt && t === void 0) {
      const s = i !== void 0 && i.length === 1;
      s && (t = re.get(i)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && re.set(i, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const ai = (e) => new Ve(typeof e == "string" ? e : e + "", void 0, Xt), rt = (e, ...t) => {
  const i = e.length === 1 ? e[0] : t.reduce((s, r, o) => s + ((n) => {
    if (n._$cssResult$ === !0) return n.cssText;
    if (typeof n == "number") return n;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + n + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(r) + e[o + 1], e[0]);
  return new Ve(i, e, Xt);
}, hi = (e, t) => {
  if (Yt) e.adoptedStyleSheets = t.map((i) => i instanceof CSSStyleSheet ? i : i.styleSheet);
  else for (const i of t) {
    const s = document.createElement("style"), r = St.litNonce;
    r !== void 0 && s.setAttribute("nonce", r), s.textContent = i.cssText, e.appendChild(s);
  }
}, oe = Yt ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((t) => {
  let i = "";
  for (const s of t.cssRules) i += s.cssText;
  return ai(i);
})(e) : e;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: li, defineProperty: ci, getOwnPropertyDescriptor: di, getOwnPropertyNames: pi, getOwnPropertySymbols: ui, getPrototypeOf: _i } = Object, Ct = globalThis, ne = Ct.trustedTypes, fi = ne ? ne.emptyScript : "", mi = Ct.reactiveElementPolyfillSupport, _t = (e, t) => e, Et = { toAttribute(e, t) {
  switch (t) {
    case Boolean:
      e = e ? fi : null;
      break;
    case Object:
    case Array:
      e = e == null ? e : JSON.stringify(e);
  }
  return e;
}, fromAttribute(e, t) {
  let i = e;
  switch (t) {
    case Boolean:
      i = e !== null;
      break;
    case Number:
      i = e === null ? null : Number(e);
      break;
    case Object:
    case Array:
      try {
        i = JSON.parse(e);
      } catch {
        i = null;
      }
  }
  return i;
} }, Kt = (e, t) => !li(e, t), ae = { attribute: !0, type: String, converter: Et, reflect: !1, useDefault: !1, hasChanged: Kt };
Symbol.metadata ??= Symbol("metadata"), Ct.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let nt = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, i = ae) {
    if (i.state && (i.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((i = Object.create(i)).wrapped = !0), this.elementProperties.set(t, i), !i.noAccessor) {
      const s = Symbol(), r = this.getPropertyDescriptor(t, s, i);
      r !== void 0 && ci(this.prototype, t, r);
    }
  }
  static getPropertyDescriptor(t, i, s) {
    const { get: r, set: o } = di(this.prototype, t) ?? { get() {
      return this[i];
    }, set(n) {
      this[i] = n;
    } };
    return { get: r, set(n) {
      const a = r?.call(this);
      o?.call(this, n), this.requestUpdate(t, a, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? ae;
  }
  static _$Ei() {
    if (this.hasOwnProperty(_t("elementProperties"))) return;
    const t = _i(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(_t("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(_t("properties"))) {
      const i = this.properties, s = [...pi(i), ...ui(i)];
      for (const r of s) this.createProperty(r, i[r]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const i = litPropertyMetadata.get(t);
      if (i !== void 0) for (const [s, r] of i) this.elementProperties.set(s, r);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [i, s] of this.elementProperties) {
      const r = this._$Eu(i, s);
      r !== void 0 && this._$Eh.set(r, i);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const i = [];
    if (Array.isArray(t)) {
      const s = new Set(t.flat(1 / 0).reverse());
      for (const r of s) i.unshift(oe(r));
    } else t !== void 0 && i.push(oe(t));
    return i;
  }
  static _$Eu(t, i) {
    const s = i.attribute;
    return s === !1 ? void 0 : typeof s == "string" ? s : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t) => t(this));
  }
  addController(t) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t), this.renderRoot !== void 0 && this.isConnected && t.hostConnected?.();
  }
  removeController(t) {
    this._$EO?.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), i = this.constructor.elementProperties;
    for (const s of i.keys()) this.hasOwnProperty(s) && (t.set(s, this[s]), delete this[s]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return hi(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, i, s) {
    this._$AK(t, s);
  }
  _$ET(t, i) {
    const s = this.constructor.elementProperties.get(t), r = this.constructor._$Eu(t, s);
    if (r !== void 0 && s.reflect === !0) {
      const o = (s.converter?.toAttribute !== void 0 ? s.converter : Et).toAttribute(i, s.type);
      this._$Em = t, o == null ? this.removeAttribute(r) : this.setAttribute(r, o), this._$Em = null;
    }
  }
  _$AK(t, i) {
    const s = this.constructor, r = s._$Eh.get(t);
    if (r !== void 0 && this._$Em !== r) {
      const o = s.getPropertyOptions(r), n = typeof o.converter == "function" ? { fromAttribute: o.converter } : o.converter?.fromAttribute !== void 0 ? o.converter : Et;
      this._$Em = r;
      const a = n.fromAttribute(i, o.type);
      this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
    }
  }
  requestUpdate(t, i, s, r = !1, o) {
    if (t !== void 0) {
      const n = this.constructor;
      if (r === !1 && (o = this[t]), s ??= n.getPropertyOptions(t), !((s.hasChanged ?? Kt)(o, i) || s.useDefault && s.reflect && o === this._$Ej?.get(t) && !this.hasAttribute(n._$Eu(t, s)))) return;
      this.C(t, i, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, i, { useDefault: s, reflect: r, wrapped: o }, n) {
    s && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, n ?? i ?? this[t]), o !== !0 || n !== void 0) || (this._$AL.has(t) || (this.hasUpdated || s || (i = void 0), this._$AL.set(t, i)), r === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (i) {
      Promise.reject(i);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [r, o] of this._$Ep) this[r] = o;
        this._$Ep = void 0;
      }
      const s = this.constructor.elementProperties;
      if (s.size > 0) for (const [r, o] of s) {
        const { wrapped: n } = o, a = this[r];
        n !== !0 || this._$AL.has(r) || a === void 0 || this.C(r, void 0, o, a);
      }
    }
    let t = !1;
    const i = this._$AL;
    try {
      t = this.shouldUpdate(i), t ? (this.willUpdate(i), this._$EO?.forEach((s) => s.hostUpdate?.()), this.update(i)) : this._$EM();
    } catch (s) {
      throw t = !1, this._$EM(), s;
    }
    t && this._$AE(i);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach((i) => i.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq &&= this._$Eq.forEach((i) => this._$ET(i, this[i])), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
nt.elementStyles = [], nt.shadowRootOptions = { mode: "open" }, nt[_t("elementProperties")] = /* @__PURE__ */ new Map(), nt[_t("finalized")] = /* @__PURE__ */ new Map(), mi?.({ ReactiveElement: nt }), (Ct.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Zt = globalThis, he = (e) => e, Pt = Zt.trustedTypes, le = Pt ? Pt.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, He = "$lit$", X = `lit$${Math.random().toFixed(9).slice(2)}$`, We = "?" + X, vi = `<${We}>`, et = document, ft = () => et.createComment(""), mt = (e) => e === null || typeof e != "object" && typeof e != "function", Jt = Array.isArray, gi = (e) => Jt(e) || typeof e?.[Symbol.iterator] == "function", Rt = `[ 	
\f\r]`, pt = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ce = /-->/g, de = />/g, Z = RegExp(`>|${Rt}(?:([^\\s"'>=/]+)(${Rt}*=${Rt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), pe = /'/g, ue = /"/g, je = /^(?:script|style|textarea|title)$/i, bi = (e) => (t, ...i) => ({ _$litType$: e, strings: t, values: i }), p = bi(1), it = Symbol.for("lit-noChange"), b = Symbol.for("lit-nothing"), _e = /* @__PURE__ */ new WeakMap(), tt = et.createTreeWalker(et, 129);
function qe(e, t) {
  if (!Jt(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return le !== void 0 ? le.createHTML(t) : t;
}
const wi = (e, t) => {
  const i = e.length - 1, s = [];
  let r, o = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", n = pt;
  for (let a = 0; a < i; a++) {
    const h = e[a];
    let u, d, l = -1, _ = 0;
    for (; _ < h.length && (n.lastIndex = _, d = n.exec(h), d !== null); ) _ = n.lastIndex, n === pt ? d[1] === "!--" ? n = ce : d[1] !== void 0 ? n = de : d[2] !== void 0 ? (je.test(d[2]) && (r = RegExp("</" + d[2], "g")), n = Z) : d[3] !== void 0 && (n = Z) : n === Z ? d[0] === ">" ? (n = r ?? pt, l = -1) : d[1] === void 0 ? l = -2 : (l = n.lastIndex - d[2].length, u = d[1], n = d[3] === void 0 ? Z : d[3] === '"' ? ue : pe) : n === ue || n === pe ? n = Z : n === ce || n === de ? n = pt : (n = Z, r = void 0);
    const v = n === Z && e[a + 1].startsWith("/>") ? " " : "";
    o += n === pt ? h + vi : l >= 0 ? (s.push(u), h.slice(0, l) + He + h.slice(l) + X + v) : h + X + (l === -2 ? a : v);
  }
  return [qe(e, o + (e[i] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class vt {
  constructor({ strings: t, _$litType$: i }, s) {
    let r;
    this.parts = [];
    let o = 0, n = 0;
    const a = t.length - 1, h = this.parts, [u, d] = wi(t, i);
    if (this.el = vt.createElement(u, s), tt.currentNode = this.el.content, i === 2 || i === 3) {
      const l = this.el.content.firstChild;
      l.replaceWith(...l.childNodes);
    }
    for (; (r = tt.nextNode()) !== null && h.length < a; ) {
      if (r.nodeType === 1) {
        if (r.hasAttributes()) for (const l of r.getAttributeNames()) if (l.endsWith(He)) {
          const _ = d[n++], v = r.getAttribute(l).split(X), y = /([.?@])?(.*)/.exec(_);
          h.push({ type: 1, index: o, name: y[2], strings: v, ctor: y[1] === "." ? xi : y[1] === "?" ? ki : y[1] === "@" ? Si : Ft }), r.removeAttribute(l);
        } else l.startsWith(X) && (h.push({ type: 6, index: o }), r.removeAttribute(l));
        if (je.test(r.tagName)) {
          const l = r.textContent.split(X), _ = l.length - 1;
          if (_ > 0) {
            r.textContent = Pt ? Pt.emptyScript : "";
            for (let v = 0; v < _; v++) r.append(l[v], ft()), tt.nextNode(), h.push({ type: 2, index: ++o });
            r.append(l[_], ft());
          }
        }
      } else if (r.nodeType === 8) if (r.data === We) h.push({ type: 2, index: o });
      else {
        let l = -1;
        for (; (l = r.data.indexOf(X, l + 1)) !== -1; ) h.push({ type: 7, index: o }), l += X.length - 1;
      }
      o++;
    }
  }
  static createElement(t, i) {
    const s = et.createElement("template");
    return s.innerHTML = t, s;
  }
}
function lt(e, t, i = e, s) {
  if (t === it) return t;
  let r = s !== void 0 ? i._$Co?.[s] : i._$Cl;
  const o = mt(t) ? void 0 : t._$litDirective$;
  return r?.constructor !== o && (r?._$AO?.(!1), o === void 0 ? r = void 0 : (r = new o(e), r._$AT(e, i, s)), s !== void 0 ? (i._$Co ??= [])[s] = r : i._$Cl = r), r !== void 0 && (t = lt(e, r._$AS(e, t.values), r, s)), t;
}
class yi {
  constructor(t, i) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = i;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: i }, parts: s } = this._$AD, r = (t?.creationScope ?? et).importNode(i, !0);
    tt.currentNode = r;
    let o = tt.nextNode(), n = 0, a = 0, h = s[0];
    for (; h !== void 0; ) {
      if (n === h.index) {
        let u;
        h.type === 2 ? u = new ct(o, o.nextSibling, this, t) : h.type === 1 ? u = new h.ctor(o, h.name, h.strings, this, t) : h.type === 6 && (u = new $i(o, this, t)), this._$AV.push(u), h = s[++a];
      }
      n !== h?.index && (o = tt.nextNode(), n++);
    }
    return tt.currentNode = et, r;
  }
  p(t) {
    let i = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(t, s, i), i += s.strings.length - 2) : s._$AI(t[i])), i++;
  }
}
class ct {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, i, s, r) {
    this.type = 2, this._$AH = b, this._$AN = void 0, this._$AA = t, this._$AB = i, this._$AM = s, this.options = r, this._$Cv = r?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const i = this._$AM;
    return i !== void 0 && t?.nodeType === 11 && (t = i.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, i = this) {
    t = lt(this, t, i), mt(t) ? t === b || t == null || t === "" ? (this._$AH !== b && this._$AR(), this._$AH = b) : t !== this._$AH && t !== it && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : gi(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== b && mt(this._$AH) ? this._$AA.nextSibling.data = t : this.T(et.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: i, _$litType$: s } = t, r = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = vt.createElement(qe(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === r) this._$AH.p(i);
    else {
      const o = new yi(r, this), n = o.u(this.options);
      o.p(i), this.T(n), this._$AH = o;
    }
  }
  _$AC(t) {
    let i = _e.get(t.strings);
    return i === void 0 && _e.set(t.strings, i = new vt(t)), i;
  }
  k(t) {
    Jt(this._$AH) || (this._$AH = [], this._$AR());
    const i = this._$AH;
    let s, r = 0;
    for (const o of t) r === i.length ? i.push(s = new ct(this.O(ft()), this.O(ft()), this, this.options)) : s = i[r], s._$AI(o), r++;
    r < i.length && (this._$AR(s && s._$AB.nextSibling, r), i.length = r);
  }
  _$AR(t = this._$AA.nextSibling, i) {
    for (this._$AP?.(!1, !0, i); t !== this._$AB; ) {
      const s = he(t).nextSibling;
      he(t).remove(), t = s;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class Ft {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, i, s, r, o) {
    this.type = 1, this._$AH = b, this._$AN = void 0, this.element = t, this.name = i, this._$AM = r, this.options = o, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = b;
  }
  _$AI(t, i = this, s, r) {
    const o = this.strings;
    let n = !1;
    if (o === void 0) t = lt(this, t, i, 0), n = !mt(t) || t !== this._$AH && t !== it, n && (this._$AH = t);
    else {
      const a = t;
      let h, u;
      for (t = o[0], h = 0; h < o.length - 1; h++) u = lt(this, a[s + h], i, h), u === it && (u = this._$AH[h]), n ||= !mt(u) || u !== this._$AH[h], u === b ? t = b : t !== b && (t += (u ?? "") + o[h + 1]), this._$AH[h] = u;
    }
    n && !r && this.j(t);
  }
  j(t) {
    t === b ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class xi extends Ft {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === b ? void 0 : t;
  }
}
class ki extends Ft {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== b);
  }
}
class Si extends Ft {
  constructor(t, i, s, r, o) {
    super(t, i, s, r, o), this.type = 5;
  }
  _$AI(t, i = this) {
    if ((t = lt(this, t, i, 0) ?? b) === it) return;
    const s = this._$AH, r = t === b && s !== b || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, o = t !== b && (s === b || r);
    r && this.element.removeEventListener(this.name, this, s), o && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class $i {
  constructor(t, i, s) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = i, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    lt(this, t);
  }
}
const Ti = { I: ct }, Ei = Zt.litHtmlPolyfillSupport;
Ei?.(vt, ct), (Zt.litHtmlVersions ??= []).push("3.3.3");
const Ge = (e, t, i) => {
  const s = i?.renderBefore ?? t;
  let r = s._$litPart$;
  if (r === void 0) {
    const o = i?.renderBefore ?? null;
    s._$litPart$ = r = new ct(t.insertBefore(ft(), o), o, void 0, i ?? {});
  }
  return r._$AI(e), r;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Qt = globalThis;
let j = class extends nt {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const i = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Ge(i, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return it;
  }
};
j._$litElement$ = !0, j.finalized = !0, Qt.litElementHydrateSupport?.({ LitElement: j });
const Pi = Qt.litElementPolyfillSupport;
Pi?.({ LitElement: j });
(Qt.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ot = (e) => (t, i) => {
  i !== void 0 ? i.addInitializer(() => {
    customElements.define(e, t);
  }) : customElements.define(e, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Mi = { attribute: !0, type: String, converter: Et, reflect: !1, hasChanged: Kt }, Ai = (e = Mi, t, i) => {
  const { kind: s, metadata: r } = i;
  let o = globalThis.litPropertyMetadata.get(r);
  if (o === void 0 && globalThis.litPropertyMetadata.set(r, o = /* @__PURE__ */ new Map()), s === "setter" && ((e = Object.create(e)).wrapped = !0), o.set(i.name, e), s === "accessor") {
    const { name: n } = i;
    return { set(a) {
      const h = t.get.call(this);
      t.set.call(this, a), this.requestUpdate(n, h, e, !0, a);
    }, init(a) {
      return a !== void 0 && this.C(n, void 0, e, a), a;
    } };
  }
  if (s === "setter") {
    const { name: n } = i;
    return function(a) {
      const h = this[n];
      t.call(this, a), this.requestUpdate(n, h, e, !0, a);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function c(e) {
  return (t, i) => typeof i == "object" ? Ai(e, t, i) : ((s, r, o) => {
    const n = r.hasOwnProperty(o);
    return r.constructor.createProperty(o, s), n ? Object.getOwnPropertyDescriptor(r, o) : void 0;
  })(e, t, i);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function m(e) {
  return c({ ...e, state: !0, attribute: !1 });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ye = (e, t, i) => (i.configurable = !0, i.enumerable = !0, Reflect.decorate && typeof t != "object" && Object.defineProperty(e, t, i), i);
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function G(e, t) {
  return (i, s, r) => {
    const o = (n) => n.renderRoot?.querySelector(e) ?? null;
    return Ye(i, s, { get() {
      return o(this);
    } });
  };
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
let Ci;
function Fi(e) {
  return (t, i) => Ye(t, i, { get() {
    return (this.renderRoot ?? (Ci ??= document.createDocumentFragment())).querySelectorAll(e);
  } });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const zi = { CHILD: 2 }, te = (e) => (...t) => ({ _$litDirective$: e, values: t });
let ee = class {
  constructor(t) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t, i, s) {
    this._$Ct = t, this._$AM = i, this._$Ci = s;
  }
  _$AS(t, i) {
    return this.update(t, i);
  }
  update(t, i) {
    return this.render(...i);
  }
};
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { I: Ri } = Ti, fe = (e) => e, me = (e, t) => e?._$litType$ !== void 0, Li = (e) => e?._$litType$?.h != null, ve = () => document.createComment(""), Q = (e, t, i) => {
  const s = e._$AA.parentNode, r = t === void 0 ? e._$AB : t._$AA;
  if (i === void 0) {
    const o = s.insertBefore(ve(), r), n = s.insertBefore(ve(), r);
    i = new Ri(o, n, e, e.options);
  } else {
    const o = i._$AB.nextSibling, n = i._$AM, a = n !== e;
    if (a) {
      let h;
      i._$AQ?.(e), i._$AM = e, i._$AP !== void 0 && (h = e._$AU) !== n._$AU && i._$AP(h);
    }
    if (o !== r || a) {
      let h = i._$AA;
      for (; h !== o; ) {
        const u = fe(h).nextSibling;
        fe(s).insertBefore(h, r), h = u;
      }
    }
  }
  return i;
}, J = (e, t, i = e) => (e._$AI(t, i), e), Di = {}, Mt = (e, t = Di) => e._$AH = t, Wt = (e) => e._$AH, Lt = (e) => {
  e._$AR(), e._$AA.remove();
}, Oi = (e) => {
  e._$AR();
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ge = (e) => Li(e) ? e._$litType$.h : e.strings, Ii = te(class extends ee {
  constructor(e) {
    super(e), this.et = /* @__PURE__ */ new WeakMap();
  }
  render(e) {
    return [e];
  }
  update(e, [t]) {
    const i = me(this.it) ? ge(this.it) : null, s = me(t) ? ge(t) : null;
    if (i !== null && (s === null || i !== s)) {
      const r = Wt(e).pop();
      let o = this.et.get(i);
      if (o === void 0) {
        const n = document.createDocumentFragment();
        o = Ge(b, n), o.setConnected(!1), this.et.set(i, o);
      }
      Mt(o, [r]), Q(o, void 0, r);
    }
    if (s !== null) {
      if (i === null || i !== s) {
        const r = this.et.get(s);
        if (r !== void 0) {
          const o = Wt(r).pop();
          Oi(e), Q(e, void 0, o), Mt(e, [o]);
        }
      }
      this.it = t;
    } else this.it = void 0;
    return this.render(t);
  }
}), Bi = "/protect_scrub", ie = "/protect_thumbs", be = "/local/protect_thumbs";
function Ni(e) {
  return e.startsWith(`${be}/`) ? ie + e.slice(be.length) : e;
}
function Ui(e) {
  return (e instanceof Date ? e : new Date(e)).toISOString();
}
function Xe(e, t, i, s) {
  let r = `/api/unifiprotect/snapshot/${encodeURIComponent(e)}/${encodeURIComponent(
    t
  )}/${encodeURIComponent(Ui(i))}`;
  const o = [];
  return s?.width && o.push(`width=${Math.round(s.width)}`), s?.height && o.push(`height=${Math.round(s.height)}`), o.length && (r += `?${o.join("&")}`), r;
}
function Vi(e, t, i) {
  if (e.fetchWithAuth) return e.fetchWithAuth(t, i);
  const s = e.auth?.accessToken;
  return fetch(t, {
    ...i,
    headers: { ...i.headers, ...s ? { Authorization: `Bearer ${s}` } : {} }
  });
}
async function Ke(e, t, i = 300) {
  try {
    return (await e.callWS({
      type: "auth/sign_path",
      path: t,
      expires: i
    })).path;
  } catch (s) {
    return console.warn("[unifi-timeline] auth/sign_path failed, using raw path", s), t;
  }
}
const Hi = 3 * 6e4, Wi = {
  motion: { label: "Motion", color: "#5c8aff" },
  person: { label: "Person", color: "#3ddc84" },
  vehicle: { label: "Vehicle", color: "#ffb300" },
  animal: { label: "Animal", color: "#ab47bc" }
};
function Ze(e) {
  const t = Wi[e.kind] ?? {
    label: e.kind ? e.kind[0].toUpperCase() + e.kind.slice(1) : "Event",
    color: "#5c8aff"
  };
  return {
    type: `protect:${e.id}`,
    label: t.label,
    color: t.color,
    start: e.start,
    end: e.end,
    id: e.id,
    // Entries written before the cache moved out of www/ carry an absolute
    // /local/... URL — rewrite them onto the current base.
    file: e.file ? Ni(e.file) : void 0,
    durMs: e.dur,
    ongoing: e.ongoing
  };
}
async function Je(e) {
  try {
    const t = await fetch(`${e}/manifest.json`, { cache: "no-cache" });
    if (!t.ok) return;
    const i = await t.json();
    if (Array.isArray(i))
      return { entries: i, preMs: 0, postMs: 0, stale: !0 };
    if (i && Array.isArray(i.events))
      return {
        entries: i.events,
        preMs: i.pre_ms ?? 0,
        postMs: i.post_ms ?? 0,
        stale: Date.now() - (i.generated ?? 0) > Hi
      };
  } catch {
  }
}
const Qe = 1e3, st = 60 * Qe, ji = 60 * st, jt = 4 * st, ti = 60 * st, V = (() => {
  const t = Math.pow(ti / jt, 0.034482758620689655);
  return Array.from({ length: 30 }, (i, s) => Math.round(jt * Math.pow(t, s)));
})(), zt = 0.15, qi = 0.179;
function M(e) {
  return e.end - e.start;
}
function Gi(e) {
  return Math.min(ti, Math.max(jt, e));
}
function P(e, t = zt) {
  return e.end - M(e) * t;
}
const Yi = st, Xi = 6 * ji;
function U(e, t, i = zt) {
  const s = Math.min(Xi, Math.max(Yi, t)), r = e + s * i;
  return { start: r - s, end: r };
}
function Ki(e, t) {
  let i = 0, s = 1 / 0;
  for (let o = 0; o < V.length; o++) {
    const n = Math.abs(V[o] - e);
    n < s && (s = n, i = o);
  }
  const r = Math.min(V.length - 1, Math.max(0, i + t));
  return V[r];
}
function we(e, t) {
  const i = -new Date(e.start).getTimezoneOffset() * 6e4, s = Math.ceil((e.start + i) / t) * t - i, r = [];
  for (let o = s; o <= e.end; o += t) r.push(o);
  return r;
}
const Zi = 1500;
function Ji(e) {
  const t = (e.s ?? e.state ?? "").toString();
  let i;
  return typeof e.lu == "number" ? i = e.lu * 1e3 : typeof e.lc == "number" ? i = e.lc * 1e3 : e.last_updated ? i = Date.parse(e.last_updated) : e.last_changed && (i = Date.parse(e.last_changed)), i === void 0 || Number.isNaN(i) || !t ? null : { state: t, ts: i };
}
const Qi = /* @__PURE__ */ new Set(["unavailable", "unknown"]);
function ts(e, t, i, s = Zi) {
  const r = e.map(Ji).filter((a) => a !== null).sort((a, h) => a.ts - h.ts), o = [];
  let n = null;
  for (const a of r)
    if (Qi.has(a.state))
      n === null && (n = Math.max(a.ts, t));
    else if (n !== null) {
      const h = Math.min(a.ts, i);
      h - n >= s && o.push({ start: n, end: h }), n = null;
    }
  return n !== null && i - n >= s && o.push({ start: n, end: i }), o;
}
const es = [0.5, 0.15, 0.85], wt = /* @__PURE__ */ new Map(), is = 500;
async function ss(e, t, i, s) {
  const r = new AbortController();
  try {
    const n = (await Vi(e, Xe(t, i, s), {
      signal: r.signal
    })).status === 200;
    return r.abort(), n;
  } catch {
    return null;
  }
}
async function rs(e, t, i, s, r = 24) {
  if (!t || !i || !s.length) return s;
  const o = [];
  let n = r;
  for (const a of s) {
    const h = `${i}|${a.start}|${a.end}`, u = wt.get(h);
    if (u !== void 0) {
      u && o.push(a);
      continue;
    }
    let d = !1;
    for (const l of es) {
      if (n <= 0) break;
      n--;
      const _ = await ss(e, t, i, a.start + (a.end - a.start) * l);
      if (_ !== null && _) {
        d = !0;
        break;
      }
    }
    d || o.push(a), (d || n > 0) && (wt.size >= is && wt.clear(), wt.set(h, !d));
  }
  return o;
}
async function os(e, t, i, s, r = "") {
  if (!t) return [];
  let o;
  try {
    o = await e.callWS({
      type: "history/history_during_period",
      start_time: new Date(i).toISOString(),
      end_time: new Date(s).toISOString(),
      entity_ids: [t],
      minimal_response: !0,
      no_attributes: !0,
      significant_changes_only: !1
    });
  } catch (a) {
    return console.error("[unifi-timeline] gap history fetch failed", a), [];
  }
  const n = ts(o[t] ?? [], i, s);
  return rs(e, r, t, n);
}
function ei(e, t) {
  for (const i of e) if (t >= i.start && t <= i.end) return !0;
  return !1;
}
function $t(e) {
  history.pushState(null, "", e), window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: !1 } }));
}
const ye = ["person", "vehicle", "animal", "package", "license plate"];
function xe(e) {
  const t = ye.indexOf(e.label.toLowerCase());
  return t === -1 ? ye.length : t;
}
function ii(e, t) {
  if (t <= 0 || e.length === 0) return e;
  const i = [...e].sort((n, a) => n.start - a.start), s = [];
  let r = [i[0]], o = i[0].end;
  for (let n = 1; n < i.length; n++) {
    const a = i[n];
    a.start - o <= t ? (r.push(a), o = Math.max(o, a.end)) : (s.push(r), r = [a], o = a.end);
  }
  return s.push(r), s.map(ns).sort((n, a) => a.start - n.start);
}
function ns(e) {
  const t = e[0];
  if (e.length === 1) return { ...t, members: e };
  const i = e.reduce((n, a) => Math.max(n, a.end), t.end), s = e.reduce((n, a) => xe(a) < xe(n) ? a : n, t), r = e.find((n) => n.file), o = e.some((n) => n.ongoing);
  return {
    type: t.type,
    label: s.label,
    color: s.color,
    start: t.start,
    end: i,
    id: t.id,
    file: r?.file,
    durMs: i - t.start,
    ongoing: o || void 0,
    members: e
  };
}
const as = 6e4, hs = 15e3;
class si {
  // in-flight fetches (cancelable)
  /** @param onLoaded called after each thumbnail resolves, to trigger a redraw. */
  constructor(t, i) {
    this._maxConcurrent = t, this._onLoaded = i, this._cache = /* @__PURE__ */ new Map(), this._loading = /* @__PURE__ */ new Set(), this._queue = [], this._active = 0, this._nvrId = "", this._cameraId = "", this._maxCache = 600, this._failed = /* @__PURE__ */ new Map(), this._gaps = [], this._controllers = /* @__PURE__ */ new Set();
  }
  configure(t, i, s, r) {
    this._hass = t, this._nvrId = i, this._cameraId = s, r && r > 0 && (this._maxConcurrent = r);
  }
  /** Camera-offline spans: snapshots inside them have no footage, so we never
   *  probe the NVR there (it would just 404/500 and re-fire every render). */
  setGaps(t) {
    this._gaps = t;
  }
  /** Abort all in-flight snapshot fetches and drop the pending queue (card is
   *  disconnecting — nothing will consume the results). */
  cancelAll() {
    this._queue.length = 0;
    for (const t of this._controllers) t.abort();
  }
  _key(t) {
    return t.id ?? `${t.type}@${t.start}`;
  }
  /** Thumbnail URL for an event. In order of preference:
   *  1. the event's own cached file (from the manifest) — exact, no NVR;
   *  2. an already-fetched blob: URL — no NVR;
   *  3. a one-time NVR snapshot fetch, cached as a blob URL. */
  get(t) {
    if (t.file) return t.file;
    const i = this._key(t), s = this._cache.get(i);
    if (s) return s;
    if (ei(this._gaps, t.start)) return;
    const r = this._failed.get(i);
    r !== void 0 && Date.now() - r < as || !this._loading.has(i) && this._hass && this._nvrId && this._cameraId && (this._loading.add(i), this._queue.push(t), this._drain());
  }
  _store(t, i) {
    if (this._cache.set(t, i), this._cache.size > this._maxCache) {
      const s = this._cache.keys().next().value;
      if (s !== void 0) {
        const r = this._cache.get(s);
        this._cache.delete(s), r && URL.revokeObjectURL(r);
      }
    }
  }
  _drain() {
    for (; this._active < this._maxConcurrent && this._queue.length; ) {
      const t = this._queue.shift(), i = this._key(t);
      this._active++;
      const s = t.camera ?? this._cameraId, r = Xe(this._nvrId, s, t.start, { width: 320 }), o = new AbortController();
      this._controllers.add(o);
      const n = setTimeout(() => o.abort(), hs);
      Ke(this._hass, r, 600).then((a) => fetch(a, { signal: o.signal })).then((a) => a.ok ? a.blob() : Promise.reject(new Error(`HTTP ${a.status}`))).then((a) => {
        this._store(i, URL.createObjectURL(a)), this._failed.delete(i);
      }).catch(() => {
        this._failed.set(i, Date.now());
      }).finally(() => {
        clearTimeout(n), this._controllers.delete(o), this._active--, this._loading.delete(i), this._drain(), this._onLoaded();
      });
    }
  }
}
const ke = /* @__PURE__ */ new Map();
function Tt(e) {
  const t = JSON.stringify(e);
  let i = ke.get(t);
  return i || (i = new Intl.DateTimeFormat(void 0, e), ke.set(t, i)), i;
}
function ht(e, t) {
  return Tt(t).format(new Date(e));
}
class ls {
  constructor(t, i, s = () => performance.now(), r = (n, a) => setTimeout(n, a), o = (n) => clearTimeout(n)) {
    this._intervalMs = t, this._emit = i, this._now = s, this._schedule = r, this._cancel = o, this._hasPending = !1, this._lastEmitAt = Number.NEGATIVE_INFINITY;
  }
  push(t) {
    this._pending = t, this._hasPending = !0;
    const i = this._intervalMs - (this._now() - this._lastEmitAt);
    i <= 0 ? this._emitPending() : this._timer === void 0 && (this._timer = this._schedule(() => {
      this._timer = void 0, this._emitPending();
    }, i));
  }
  flush(t) {
    arguments.length && (this._pending = t, this._hasPending = !0), this._timer !== void 0 && this._cancel(this._timer), this._timer = void 0, this._emitPending();
  }
  reset() {
    this._timer !== void 0 && this._cancel(this._timer), this._timer = void 0, this._pending = void 0, this._hasPending = !1, this._lastEmitAt = Number.NEGATIVE_INFINITY;
  }
  _emitPending() {
    if (!this._hasPending) return;
    const t = this._pending;
    this._pending = void 0, this._hasPending = !1, this._lastEmitAt = this._now(), this._emit(t);
  }
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Se = (e, t, i) => {
  const s = /* @__PURE__ */ new Map();
  for (let r = t; r <= i; r++) s.set(e[r], r);
  return s;
}, se = te(class extends ee {
  constructor(e) {
    if (super(e), e.type !== zi.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(e, t, i) {
    let s;
    i === void 0 ? i = t : t !== void 0 && (s = t);
    const r = [], o = [];
    let n = 0;
    for (const a of e) r[n] = s ? s(a, n) : n, o[n] = i(a, n), n++;
    return { values: o, keys: r };
  }
  render(e, t, i) {
    return this.dt(e, t, i).values;
  }
  update(e, [t, i, s]) {
    const r = Wt(e), { values: o, keys: n } = this.dt(t, i, s);
    if (!Array.isArray(r)) return this.ut = n, o;
    const a = this.ut ??= [], h = [];
    let u, d, l = 0, _ = r.length - 1, v = 0, y = o.length - 1;
    for (; l <= _ && v <= y; ) if (r[l] === null) l++;
    else if (r[_] === null) _--;
    else if (a[l] === n[v]) h[v] = J(r[l], o[v]), l++, v++;
    else if (a[_] === n[y]) h[y] = J(r[_], o[y]), _--, y--;
    else if (a[l] === n[y]) h[y] = J(r[l], o[y]), Q(e, h[y + 1], r[l]), l++, y--;
    else if (a[_] === n[v]) h[v] = J(r[_], o[v]), Q(e, r[l], r[_]), _--, v++;
    else if (u === void 0 && (u = Se(n, v, y), d = Se(a, l, _)), u.has(a[l])) if (u.has(a[_])) {
      const z = d.get(n[v]), O = z !== void 0 ? r[z] : null;
      if (O === null) {
        const N = Q(e, r[l]);
        J(N, o[v]), h[v] = N;
      } else h[v] = J(O, o[v]), Q(e, r[l], O), r[z] = null;
      v++;
    } else Lt(r[_]), _--;
    else Lt(r[l]), l++;
    for (; v <= y; ) {
      const z = Q(e, h[y + 1]);
      J(z, o[v]), h[v++] = z;
    }
    for (; l <= _; ) {
      const z = r[l++];
      z !== null && Lt(z);
    }
    return this.ut = n, Mt(e, h), it;
  }
});
var cs = Object.defineProperty, ds = Object.getOwnPropertyDescriptor, x = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? ds(t, i) : t, o = e.length - 1, n; o >= 0; o--)
    (n = e[o]) && (r = (s ? n(t, i, r) : n(r)) || r);
  return s && r && cs(t, i, r), r;
};
const ps = 62, us = 80, $e = 86, Te = 98, at = 104, _s = 2, fs = 6, ms = 8, vs = 8, gs = 20, bs = 12, Dt = 5, ws = 24, ys = 5e3, xs = 80, ks = 0.325, Ss = 20, Ee = 4e3, $s = 120, Pe = 4, Ts = 3, Me = 48, yt = 520;
function Ot(e) {
  return e.id ?? `${e.type}@${e.start}`;
}
function ri() {
  const e = (t) => {
    t.stopPropagation(), t.preventDefault();
  };
  window.addEventListener("pointerup", e, { capture: !0, once: !0 }), window.addEventListener("click", e, { capture: !0, once: !0 }), setTimeout(() => {
    window.removeEventListener("pointerup", e, !0), window.removeEventListener("click", e, !0);
  }, 700);
}
function Es(e, t) {
  const i = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(e.trim());
  if (!i) return "";
  const s = i[1].length === 3 ? i[1].split("").map((n) => n + n).join("") : i[1], r = parseInt(s, 16), o = [r >> 16 & 255, r >> 8 & 255, r & 255].map((n) => Math.round(n * t));
  return `rgb(${o[0]}, ${o[1]}, ${o[2]})`;
}
function Ps(e) {
  const t = st, i = Qe;
  return e <= 5 * t ? { major: 1 * t, minor: 15 * i } : e <= 10 * t ? { major: 1 * t, minor: 30 * i } : e <= 20 * t ? { major: 2 * t, minor: 30 * i } : e <= 40 * t ? { major: 5 * t, minor: 1 * t } : e <= 80 * t ? { major: 10 * t, minor: 1 * t } : { major: 10 * t, minor: 1 * t };
}
let w = class extends j {
  constructor() {
    super(...arguments), this.bands = [], this.gaps = [], this.gapColor = "", this.now = Date.now(), this.nvrId = "", this.cameraId = "", this.fontSize = 11, this.fontColor = "", this.accentColor = "", this.tickColor = "", this.tickSize = 7, this.recordedColor = "", this.futureColor = "", this.thumbSize = 79, this.thumbSizeActive = 95, this.thumbVersion = 0, this.live = !1, this.livePaused = !1, this.indent = 0, this.pillIndent = 0, this.mirror = !1, this.zoomUi = !0, this.rotated = !1, this.liveArrow = !1, this.compact = !1, this.playheadFrac = zt, this.gutter = 0, this._zoomOpen = !1, this._dpr = 1, this._width = 0, this._height = 0, this._setupTs = 0, this._frame = 0, this._evtAnchor = at, this._hits = [], this._gapHits = [], this._animRaf = 0, this._pointers = /* @__PURE__ */ new Map(), this._dragStartY = 0, this._dragSlop = Pe, this._moved = !1, this._gestureStarted = !1, this._gestureScrubbed = !1, this._velSamples = [], this._scrubOpen = !1, this._pillBig = !1, this._glideBig = !1, this._momentumRaf = 0, this._momentumV = 0, this._momentumLast = 0, this._seekRaf = 0, this._onLostCapture = (e) => {
      this._pointers.has(e.pointerId) && (this._pointers.delete(e.pointerId), !this._pointers.size && (this._dragStartDomain = void 0, this._scrubOpen && this._emitScrubEnd()));
    }, this._onPointerDown = (e) => {
      const t = this._scrubEl;
      e.isPrimary && this._pointers.size && this._pointers.clear();
      try {
        t.setPointerCapture(e.pointerId);
      } catch {
      }
      this._refreshRect(), this._cancelMomentum(), this._cancelSeek(), this._velSamples = [], this._gestureScrubbed = !1, this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }), this._moved = !1, this._hoverBand = void 0, this._hoverGap = void 0, this._pointers.size === 1 && (this._dragStartY = this._localY(e), this._dragStartDomain = { ...this.domain }, this._gestureStarted = !1, this._dragSlop = e.pointerType === "mouse" ? Ts : Pe);
    }, this._onPointerMove = (e) => {
      if (this._pointers.size === 0) {
        this._updateHover(e);
        return;
      }
      if (!this._pointers.has(e.pointerId) || (this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }), this._pointers.size !== 1 || !this._dragStartDomain)) return;
      const t = this._localY(e);
      if (!this._moved) {
        if (Math.abs(t - this._dragStartY) <= this._dragSlop) return;
        this._moved = !0;
      }
      const i = t - this._dragStartY;
      this._moved && !this._gestureStarted && (this._gestureStarted = !0, this._scrubOpen = !0, this._syncPillBig(), this.dispatchEvent(new CustomEvent("scrub-start", { bubbles: !0, composed: !0 })));
      const s = performance.now();
      for (this._velSamples.push({ t: s, y: t }); this._velSamples.length > 1 && s - this._velSamples[0].t > $s; )
        this._velSamples.shift();
      const r = M(this._dragStartDomain), o = i / (this._height || 1) * r;
      let n = {
        start: this._dragStartDomain.start + o,
        end: this._dragStartDomain.end + o
      };
      const a = this._height || 1, h = P(n, this.playheadFrac) - this.now;
      if (h > 0) {
        const u = h / r * a, l = Me * u / (u + Me) / a * r, _ = h - l;
        if (n = { start: n.start - _, end: n.end - _ }, this._setDomain(n, l), !this._gestureScrubbed) return;
      } else
        this._setDomain(n), this._gestureScrubbed = !0;
      this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: Math.min(P(this.domain, this.playheadFrac), this.now) },
          bubbles: !0,
          composed: !0
        })
      );
    }, this._onPointerUp = (e) => {
      if (!this._pointers.has(e.pointerId)) return;
      const t = this._pointers.size >= 2;
      this._pointers.delete(e.pointerId);
      try {
        this._scrubEl.releasePointerCapture(e.pointerId);
      } catch {
      }
      if (this._pointers.size === 1) {
        const i = [...this._pointers.values()][0];
        this._dragStartY = this._localY({ clientX: i.x, clientY: i.y }), this._dragStartDomain = { ...this.domain };
        return;
      }
      if (this._pointers.size === 0) {
        if (this._dragStartDomain = void 0, !this._moved && !t) {
          const s = this._thumbAt(e);
          if (s) {
            this._seekTo(s.m.start);
            return;
          }
          this._scrubOpen && this._emitScrubEnd(), this.dispatchEvent(new CustomEvent("tap-through", { bubbles: !0, composed: !0 }));
          return;
        }
        if (P(this.domain, this.playheadFrac) > this.now && this._animateFrom({ ...this.domain }, this._applyDomain(U(this.now, M(this.domain), this.playheadFrac))), !this._gestureScrubbed) {
          this._velSamples = [], this._scrubOpen = !1, this._syncPillBig(), this.dispatchEvent(new CustomEvent("scrub-cancel", { bubbles: !0, composed: !0 }));
          return;
        }
        const i = this._releaseVelocity();
        if (!t && Math.abs(i) >= xs) {
          this._startMomentum(i);
          return;
        }
        this._emitScrubEnd();
      }
    }, this._onPointerLeave = () => {
      this._pointers.size === 0 && (this._clearHover(), this._hoverGap = void 0);
    }, this._onWheel = (e) => {
      e.preventDefault(), this._cancelMomentum(), this._cancelSeek();
      const t = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, i = P(this.domain, this.playheadFrac);
      this._panByPixels(-t), !(t < 0 && i >= this.now - 50 && !this._scrubEndTimer) && (this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: Math.min(P(this.domain, this.playheadFrac), this.now) },
          bubbles: !0,
          composed: !0
        })
      ), this._holdPillBig(), this._debouncedScrubEnd());
    }, this._setHover = (e) => {
      this._hoverBand = e, this.loader?.get(e);
    }, this._clearHover = () => {
      this._hoverBand = void 0;
    }, this._zoomIn = () => this._zoomStep(-1), this._zoomOut = () => this._zoomStep(1), this._outsideZoomClose = (e) => {
      const t = this.renderRoot.querySelector(".zoom-panel");
      t && e.composedPath().includes(t) || (e.preventDefault(), e.stopPropagation(), ri(), this._closeZoom());
    }, this._openZoom = () => {
      this._zoomOpen || (this._zoomOpen = !0, window.addEventListener("pointerdown", this._outsideZoomClose, !0));
    }, this._zoomDragging = !1, this._onZoomSliderDown = (e) => {
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
      }
      this._zoomDragging = !0, this._zoomSliderFromEvent(e);
    }, this._onZoomSliderMove = (e) => {
      e.stopPropagation(), this._zoomDragging && this._zoomSliderFromEvent(e);
    }, this._onZoomSliderUp = (e) => {
      e.stopPropagation(), this._zoomDragging = !1;
    }, this._goLive = (e) => {
      e.stopPropagation(), this.dispatchEvent(new CustomEvent("go-live", { bubbles: !0, composed: !0 }));
    }, this._kept = [];
  }
  /** The pill is big while the ruler is moving, from EITHER source. */
  _syncPillBig() {
    this._pillBig = this._scrubOpen || this._glideBig;
  }
  /** Hold the pill big for `ms` on behalf of ruler motion that has no pointer
   *  gesture behind it — a skip-button glide, or a wheel/trackpad scroll (which
   *  emits `scrub` without ever opening a session). Re-armable: each new wheel
   *  notch pushes the release back, so a long scroll stays big throughout. */
  _holdPillBig(e = yt) {
    this._glideBig = !0, this._syncPillBig(), clearTimeout(this._pillBigTimer), this._pillBigTimer = setTimeout(() => {
      this._pillBigTimer = void 0, this._glideBig = !1, this._syncPillBig();
    }, e);
  }
  connectedCallback() {
    super.connectedCallback(), this.hasUpdated && this._setup();
  }
  firstUpdated() {
    this._setup();
  }
  /** (Re)bind gestures + ResizeObserver and measure. Safe to call repeatedly. */
  _setup() {
    this._canvas && (this._setupTs = performance.now(), this._dpr = window.devicePixelRatio || 1, this._ro?.disconnect(), this._ro = new ResizeObserver(() => this._resize()), this._ro.observe(this._canvas), this._bindPointer(), this._resize(), requestAnimationFrame(() => requestAnimationFrame(() => this._resize())));
  }
  updated(e) {
    w._redrawProps.some((t) => e.has(t)) && this._scheduleDraw();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    const e = this._scrubEl;
    e && (e.removeEventListener("pointerdown", this._onPointerDown), e.removeEventListener("pointermove", this._onPointerMove), e.removeEventListener("pointerup", this._onPointerUp), e.removeEventListener("pointercancel", this._onPointerUp), e.removeEventListener("pointerleave", this._onPointerLeave), e.removeEventListener("wheel", this._onWheel), e.removeEventListener("lostpointercapture", this._onLostCapture)), this._ro?.disconnect(), cancelAnimationFrame(this._frame), cancelAnimationFrame(this._animRaf), this._cancelMomentum(), this._cancelSeek(), this._pointers.clear(), this._dragStartDomain = void 0, this._scrubOpen && this._emitScrubEnd(), window.removeEventListener("pointerdown", this._outsideZoomClose, !0);
  }
  // ---- geometry -----------------------------------------------------------
  // The domain used for drawing — equals `domain`, except mid zoom-animation
  // when it's the interpolated value, so labels/events glide to their new spots.
  get _dd() {
    return this._animDomain ?? this.domain;
  }
  _timeToY(e) {
    const t = M(this._dd) || 1;
    return (this._dd.end - e) / t * this._height;
  }
  _yToTime(e) {
    const t = M(this._dd) || 1;
    return this._dd.end - e / (this._height || 1) * t;
  }
  get _playheadY() {
    return this._height * this.playheadFrac;
  }
  // ---- gestures -----------------------------------------------------------
  _bindPointer() {
    const e = this._scrubEl;
    e && (e.removeEventListener("pointerdown", this._onPointerDown), e.removeEventListener("pointermove", this._onPointerMove), e.removeEventListener("pointerup", this._onPointerUp), e.removeEventListener("pointercancel", this._onPointerUp), e.removeEventListener("pointerleave", this._onPointerLeave), e.removeEventListener("wheel", this._onWheel), e.addEventListener("pointerdown", this._onPointerDown), e.addEventListener("pointermove", this._onPointerMove), e.addEventListener("pointerup", this._onPointerUp), e.addEventListener("pointercancel", this._onPointerUp), e.addEventListener("pointerleave", this._onPointerLeave), e.addEventListener("wheel", this._onWheel, { passive: !1 }), e.removeEventListener("lostpointercapture", this._onLostCapture), e.addEventListener("lostpointercapture", this._onLostCapture));
  }
  _refreshRect() {
    this._rect = this._scrubEl.getBoundingClientRect();
  }
  /** A pointer's position along the element's OWN vertical axis (px from its
   *  top edge) — the only axis every gesture below cares about.
   *  When `rotated`, the player is CSS-rotated 90°: local (x, y) paints at
   *  screen (−y, x), so the finger's perceived-vertical motion arrives as
   *  clientX and local y grows leftward from the transformed box's right edge.
   *  The rotation is exactly 90°, so the axis-aligned client rect is exact. */
  _localY(e) {
    const t = this._rect;
    return t ? this.rotated ? t.right - e.clientX : e.clientY - t.top : 0;
  }
  /** The kept thumbnail whose rendered box contains a pointer, if any.
   *  Hit-tested against the LIVE DOM rects rather than re-deriving the
   *  thumbnail geometry here: that stays exact in the mirrored layout, at the
   *  enlarged size, and inside the CSS-rotated mobile player (a 90° rotation
   *  leaves the axis-aligned client rect exact). Only on-screen thumbs exist,
   *  so this walks a handful of nodes. */
  _thumbAt(e) {
    const t = this.renderRoot.querySelectorAll(".evt-wrap");
    for (const i of t) {
      const s = i.getBoundingClientRect();
      if (e.clientX < s.left || e.clientX > s.right || e.clientY < s.top || e.clientY > s.bottom) continue;
      const r = i.dataset.key, o = this._kept.find((n) => Ot(n.m) === r);
      if (o) return o;
    }
  }
  _nearestEvent(e) {
    let t, i = 1 / 0;
    for (const s of this._hits) {
      const r = e < s.yTop ? s.yTop - e : e > s.yBot ? e - s.yBot : 0;
      r < i && (i = r, t = s);
    }
    return t ? { hit: t, dist: i } : void 0;
  }
  /** Start a gesture from a press that landed OUTSIDE the scrub surface — the
   *  fullscreen overlay's margins (media-view's _onStripPress). The pointer is
   *  captured to the surface here, so the rest of the drag arrives as if it
   *  had started on the ruler. */
  beginDrag(e) {
    this._onPointerDown(e);
  }
  // ---- flick momentum -------------------------------------------------------
  /** Average pointer velocity (px/s, clientY direction) over the trailing
   *  sample window at release. 0 when the finger paused before lifting. */
  _releaseVelocity() {
    const e = this._velSamples;
    if (this._velSamples = [], e.length < 2) return 0;
    const t = e[e.length - 1].t - e[0].t;
    return t < 20 ? 0 : (e[e.length - 1].y - e[0].y) / t * 1e3;
  }
  /** iOS-style inertia: keep panning in the flick direction, velocity decaying
   *  exponentially (tau ~325ms), emitting `scrub` per frame. Ends (and emits
   *  `scrub-end`) when slow enough or when the playhead hits the live edge. */
  _startMomentum(e) {
    this._momentumV = Math.max(-Ee, Math.min(Ee, e)), this._momentumLast = performance.now();
    const t = (i) => {
      const s = Math.min(0.1, (i - this._momentumLast) / 1e3);
      this._momentumLast = i, this._panByPixels(this._momentumV * s), this._draw(), this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: P(this.domain, this.playheadFrac) },
          bubbles: !0,
          composed: !0
        })
      ), this._momentumV *= Math.exp(-s / ks);
      const r = this._momentumV > 0 && P(this.domain, this.playheadFrac) >= this.now - 250;
      if (Math.abs(this._momentumV) < Ss || r) {
        this._momentumRaf = 0, this._emitScrubEnd();
        return;
      }
      this._momentumRaf = requestAnimationFrame(t);
    };
    cancelAnimationFrame(this._momentumRaf), this._momentumRaf = requestAnimationFrame(t);
  }
  _cancelMomentum() {
    this._momentumRaf && (cancelAnimationFrame(this._momentumRaf), this._momentumRaf = 0);
  }
  // ---- animated seek --------------------------------------------------------
  /** Wind the timeline to `t` and play the footage there — the tap-an-event
   *  gesture of the fullscreen overlay. Deliberately NOT a domain swap: the
   *  ruler SCROLLS to the moment (easing out, like a flick that lands on it),
   *  and the whole way it emits the same scrub-start / scrub / scrub-end stream
   *  a finger would, so the preview follows the motion and the footage loads
   *  once it settles. Snapping the domain instead read as a hard cut — you
   *  couldn't see which way, or how far, the timeline had gone.
   *  Per-frame draws are SYNCHRONOUS: _scheduleDraw's rAF would be cancelled by
   *  this loop's own next-frame request before it ever ran (same trap as the
   *  momentum glide). */
  _seekTo(e) {
    this._cancelMomentum(), this._cancelSeek(), cancelAnimationFrame(this._animRaf), this._animDomain = void 0;
    const t = P(this.domain, this.playheadFrac), i = Math.min(e, this.now);
    this._scrubOpen = !0, this._syncPillBig(), this.dispatchEvent(new CustomEvent("scrub-start", { bubbles: !0, composed: !0 }));
    const s = performance.now(), r = (o) => {
      const n = Math.min(1, (o - s) / yt), a = 1 - Math.pow(1 - n, 3);
      if (this._applyDomain(U(t + (i - t) * a, M(this.domain), this.playheadFrac)), this._draw(), this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: Math.min(P(this.domain, this.playheadFrac), this.now) },
          bubbles: !0,
          composed: !0
        })
      ), n < 1) {
        this._seekRaf = requestAnimationFrame(r);
        return;
      }
      this._seekRaf = 0, this._emitScrubEnd();
    };
    this._seekRaf = requestAnimationFrame(r);
  }
  /** Drop an in-flight seek glide (a new gesture always wins over it). */
  _cancelSeek() {
    this._seekRaf && (cancelAnimationFrame(this._seekRaf), this._seekRaf = 0);
  }
  _panByPixels(e) {
    const t = M(this.domain), i = e / (this._height || 1) * t;
    this._setDomain({ start: this.domain.start + i, end: this.domain.end + i });
  }
  _debouncedScrubEnd() {
    clearTimeout(this._scrubEndTimer), this._scrubEndTimer = setTimeout(() => {
      this._scrubEndTimer = void 0, this._emitScrubEnd();
    }, 500);
  }
  _updateHover(e) {
    this._refreshRect();
    const t = this._localY(e), i = this._nearestEvent(t), s = i && i.dist <= ws ? i.hit.band : void 0, r = s ? this._nearestKeptMember(s, this._yToTime(t)) : void 0;
    if (r) {
      this._setHover(r), this._hoverGap && (this._hoverGap = void 0);
      return;
    }
    this._hoverBand && this._clearHover(), this._updateGapHover(t);
  }
  /** The group's kept (visible) member nearest to time t, if any. */
  _nearestKeptMember(e, t) {
    let i, s = 1 / 0;
    for (const r of this._kept) {
      if (r.g !== e) continue;
      const o = t < r.m.start ? r.m.start - t : t > r.m.end ? t - r.m.end : 0;
      o < s && (s = o, i = r.m);
    }
    return i;
  }
  /** Show the "camera offline" tip when the cursor is over an unavailable span. */
  _updateGapHover(e) {
    let t;
    for (const i of this._gapHits)
      if (e >= i.yTop - 3 && e <= i.yBot + 3) {
        t = i;
        break;
      }
    t ? this._hoverGap?.gap !== t.gap && (this._hoverGap = { gap: t.gap, y: (t.yTop + t.yBot) / 2 }) : this._hoverGap && (this._hoverGap = void 0);
  }
  _zoomStep(e) {
    const t = Ki(M(this.domain), e);
    this._setSpan(t);
  }
  _setSpan(e) {
    this.dispatchEvent(new CustomEvent("zoom-change", { bubbles: !0, composed: !0 })), this._cancelMomentum(), this._cancelSeek();
    const t = this._animDomain ?? { ...this.domain }, i = this._applyDomain(U(P(this.domain, this.playheadFrac), e, this.playheadFrac));
    this._animateFrom(t, i);
  }
  /** Glide the ruler between two domains without touching the scrub stream —
   *  the HOST calls this when the footage POSITION jumps rather than advances
   *  (the 15s skip buttons), so the ruler scrolls to the new time the same way
   *  tapping an event thumbnail does instead of teleporting. Declined while a
   *  gesture owns the ruler: the finger, a glide or a seek must always win. */
  glideDomain(e, t, i = yt) {
    this._scrubOpen || this._seekRaf || this._momentumRaf || (this._holdPillBig(i), this._animateFrom(e, t, yt));
  }
  _animateFrom(e, t, i = 170) {
    cancelAnimationFrame(this._animRaf);
    const s = performance.now(), r = (o) => {
      const n = Math.min(1, (o - s) / i), a = 1 - Math.pow(1 - n, 3);
      this._animDomain = {
        start: e.start + (t.start - e.start) * a,
        end: e.end + (t.end - e.end) * a
      }, this._draw(), this.requestUpdate(), n < 1 ? this._animRaf = requestAnimationFrame(r) : (this._animDomain = void 0, this._draw(), this.requestUpdate());
    };
    this._animRaf = requestAnimationFrame(r);
  }
  // Slider value 0..N-1 maps 0=zoomed-out (widest span) -> N-1=zoomed-in.
  get _sliderValue() {
    const e = M(this.domain);
    let t = 0, i = 1 / 0;
    return V.forEach((s, r) => {
      const o = Math.abs(s - e);
      o < i && (i = o, t = r);
    }), V.length - 1 - t;
  }
  _closeZoom() {
    this._zoomOpen = !1, window.removeEventListener("pointerdown", this._outsideZoomClose, !0);
  }
  /** Map a pointer y on the .zslider to a SPAN_STEPS index and apply it.
   *  Top = most zoomed in (narrowest span), bottom = most zoomed out.
   *  In the CSS-rotated (mobile fullscreen) player the slider's own vertical
   *  axis runs along the screen's X, and its client rect reports that axis as
   *  WIDTH — reading clientY there mapped a 44px axis onto the whole range and
   *  ran backwards. Same mapping as _localY. */
  _zoomSliderFromEvent(e) {
    const t = this.renderRoot.querySelector(".zslider");
    if (!t) return;
    const i = t.getBoundingClientRect(), s = 8, r = this.rotated ? i.width : i.height, o = this.rotated ? i.right - e.clientX : e.clientY - i.top, n = Math.max(1, r - s * 2), a = Math.min(1, Math.max(0, (o - s) / n)), h = Math.round((1 - a) * (V.length - 1));
    h !== this._sliderValue && this._setSpan(V[V.length - 1 - h]);
  }
  /** Commit a domain (clamped so the playhead can't pass `now` — plus an
   *  optional allowance for the rubber-band overshoot); no redraw. */
  _applyDomain(e, t = 0) {
    const i = P(e, this.playheadFrac);
    if (i > this.now + t) {
      const s = i - (this.now + t);
      e = { start: e.start - s, end: e.end - s };
    }
    return this.domain = e, this.dispatchEvent(
      new CustomEvent("domain-change", { detail: e, bubbles: !0, composed: !0 })
    ), e;
  }
  /** Instant domain change (drag/wheel/tap): commit + redraw, cancel any anim. */
  _setDomain(e, t = 0) {
    cancelAnimationFrame(this._animRaf), this._animDomain = void 0, this._applyDomain(e, t), this._scheduleDraw();
  }
  _emitScrubEnd() {
    this._scrubOpen = !1, this._syncPillBig(), this.dispatchEvent(
      new CustomEvent("scrub-end", {
        detail: { time: Math.min(P(this.domain, this.playheadFrac), this.now) },
        bubbles: !0,
        composed: !0
      })
    );
  }
  // ---- rendering ----------------------------------------------------------
  _resize() {
    const e = this._canvas;
    if (!e) return;
    const t = e.getBoundingClientRect(), i = e.clientWidth, s = e.clientHeight;
    if (i < 1 || s < 1) return;
    const r = this._height;
    if (this._width = i, this._height = s, this._rect = t, this._dpr = window.devicePixelRatio || 1, performance.now() - this._setupTs > 500 && r > 0 && this.domain && Math.abs(s - r) > 0.5) {
      const n = M(this.domain) * (s / r), h = P(this.domain, this.playheadFrac) + n * this.playheadFrac;
      this._applyDomain({ start: h - n, end: h });
    }
    e.width = Math.max(1, Math.round(i * this._dpr)), e.height = Math.max(1, Math.round(s * this._dpr)), this._draw(), r !== this._height && this.requestUpdate();
  }
  _scheduleDraw() {
    cancelAnimationFrame(this._frame), this._frame = requestAnimationFrame(() => this._draw());
  }
  /** The x positions for one draw pass. Normal = the fixed left-anchored
   *  column; mirrored = the same parts anchored to the right edge, with the
   *  label column sized by the MEASURED label width so it adapts to
   *  timeline_font_size and to locales that render "19:30" vs "7:30 PM". */
  _geo(e) {
    if (!this.mirror)
      return {
        labelRight: ps,
        tickRight: us,
        trackX0: $e,
        trackX1: Te,
        evtAnchor: at
      };
    const t = this._width || 1, i = Math.max(2, Math.min(this.tickSize + 5, 18)), s = t - _s, r = s - i - fs, o = Te - $e, n = Math.max(o, r - e - ms), a = n - o;
    return { labelRight: r, tickRight: s, trackX0: a, trackX1: n, evtAnchor: t - a + vs };
  }
  _draw() {
    const e = this._canvas;
    if (!e || !this.domain) return;
    const t = e.getContext("2d");
    if (!t) return;
    const i = this._width, s = this._height;
    t.setTransform(this._dpr, 0, 0, this._dpr, 0, 0), t.clearRect(0, 0, i, s), this.indent && t.translate(this.indent, 0);
    const r = getComputedStyle(this), o = r.getPropertyValue("--secondary-text-color").trim() || "#9aa0a6", n = r.getPropertyValue("--divider-color").trim() || "rgba(255,255,255,0.12)", a = this.accentColor || r.getPropertyValue("--primary-color").trim() || "#03a9f4", h = this.fontSize || 11, u = r.fontFamily || "sans-serif";
    t.font = `${h}px ${u}`;
    const d = this._geo(
      this.mirror ? t.measureText(this._fmt(this._dd.end, { hour: "2-digit", minute: "2-digit" })).width : 0
    );
    this._evtAnchor !== d.evtAnchor && (this._evtAnchor = d.evtAnchor, this.requestUpdate());
    const l = this.recordedColor || n, _ = Math.max(0, Math.min(this._timeToY(this.now), s)), v = d.trackX1 - d.trackX0;
    if (_ > 0 && (this._roundRect(t, d.trackX0, 0, v, _, 3), this.futureColor ? (t.fillStyle = this.futureColor, t.globalAlpha = 1) : (t.fillStyle = l, t.globalAlpha = 0.7), t.fill(), t.globalAlpha = 1), _ < s && (this._roundRect(t, d.trackX0, _, v, s - _, 3), t.fillStyle = l, t.fill()), this._gapHits = [], this.gaps && this.gaps.length) {
      const W = this.gapColor || "#4a4a52";
      t.fillStyle = W, t.globalAlpha = 1;
      for (const $ of this.gaps) {
        let R = this._timeToY($.end), q = this._timeToY($.start);
        if (!(q < 0 || R > s)) {
          if (q - R < 3) {
            const K = (R + q) / 2;
            R = K - 1.5, q = K + 1.5;
          }
          this._roundRect(t, d.trackX0, R, v, q - R, 3), t.fill(), this._gapHits.push({ gap: $, yTop: R, yBot: q });
        }
      }
    }
    const { major: y, minor: z } = Ps(M(this._dd)), O = this.tickColor || o, N = Math.max(2, Math.min(this.tickSize, 16)), k = Math.max(2, Math.min(this.tickSize + 5, 18)), H = Math.max(1, Math.min(this.tickSize / 5, 2.5));
    t.strokeStyle = O, t.lineWidth = H, t.globalAlpha = 0.7;
    for (const W of we(this._dd, z)) {
      const $ = this._timeToY(W);
      $ < 4 || $ > s - 4 || (t.beginPath(), t.moveTo(d.tickRight - N, $), t.lineTo(d.tickRight, $), t.stroke());
    }
    t.globalAlpha = 1, t.lineWidth = 1, t.textBaseline = "middle", t.textAlign = "right";
    const Y = h * 0.55;
    for (const W of we(this._dd, y)) {
      const $ = this._timeToY(W);
      $ < Y || $ > s - Y || (t.strokeStyle = O, t.lineWidth = Math.max(H, 1.5), t.globalAlpha = 0.95, t.beginPath(), t.moveTo(d.tickRight - k, $), t.lineTo(d.tickRight, $), t.stroke(), t.globalAlpha = 1, t.lineWidth = 1, t.fillStyle = this.fontColor || o, t.fillText(this._fmt(W, { hour: "2-digit", minute: "2-digit" }), d.labelRight, $));
    }
    this._hits = [];
    const gt = v;
    for (const W of this.bands) {
      let $ = this._timeToY(W.end), R = this._timeToY(W.start);
      if (R < 0 || $ > s) continue;
      if (R - $ < Dt) {
        const K = ($ + R) / 2;
        $ = K - Dt / 2, R = K + Dt / 2;
      }
      this._hits.push({ band: W, colX: d.trackX1, yTop: $, yBot: R }), t.fillStyle = a;
      const q = Math.min(gt / 2, (R - $) / 2);
      t.beginPath(), t.roundRect(d.trackX0, $, gt, R - $, q), t.fill();
    }
    t.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    const bt = this._playheadY, dt = this.mirror ? Math.max(0, d.trackX0 - 6) : 0;
    t.fillStyle = a, t.globalAlpha = 0.18, t.fillRect(dt, bt - 6, i - dt, 12), t.globalAlpha = 1, t.strokeStyle = a, t.lineWidth = 3, t.beginPath(), t.moveTo(dt, bt), t.lineTo(i, bt), t.stroke(), t.lineWidth = 1;
  }
  _roundRect(e, t, i, s, r, o) {
    const n = Math.max(0, Math.min(o, s / 2, r / 2));
    e.beginPath(), e.moveTo(t + n, i), e.arcTo(t + s, i, t + s, i + r, n), e.arcTo(t + s, i + r, t, i + r, n), e.arcTo(t, i + r, t, i, n), e.arcTo(t, i, t + s, i, n), e.closePath();
  }
  // PERF-SCRUB-2026-08-03: was `new Intl.DateTimeFormat(undefined, opts)` on
  // every call — i.e. once per major tick label per canvas frame, once per frame
  // for the mirror layout's measureText, and once per Lit render for the
  // playhead pill. See data/fmt.ts for the measurements.
  // Revert: `return new Intl.DateTimeFormat(undefined, opts).format(new Date(t));`
  _fmt(e, t) {
    return ht(e, t);
  }
  render() {
    const e = this.accentColor || "var(--primary-color, #03a9f4)", t = Es(this.accentColor, 0.58), i = this.gutter ? -(this.gutter / 2 + (this.compact ? 19 : 22)) : 8, s = this.live && !this.livePaused && this.domain && this.now - P(this.domain, this.playheadFrac) < ys, r = !s && this.domain ? this._fmt(Math.min(P(this.domain, this.playheadFrac), this.now), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }) : "", o = this._height > 0 && (s || !!r), n = `--upc-thumb-w:${this.thumbSize}px;--upc-thumb-w-lg:${this.thumbSizeActive}px;`, a = 1 - this._sliderValue / (V.length - 1), h = this._renderThumbs(), u = this._evtAnchor + gs + (this._pillDodge() ? this.thumbSizeActive + bs : 0);
    return p`
      <div
        class="col"
        style="--upc-accent:${e};${t ? `--upc-accent-deep:${t};` : ""}--upc-indent:${this.indent}px;--upc-pill-left:${this.pillIndent}px;--upc-evt-right:${this._evtAnchor}px;--upc-pill-right:${u}px;--upc-fab-right:${i}px;--upc-ph-y:${this._height * this.playheadFrac}px;${n}"
      >
        <div class="scrub">
          <canvas></canvas>
          <div class="evt-layer">${h}</div>
          ${o ? p`<div
                class="live-pill ${s ? "" : "at-time"} ${this._pillBig ? "big" : ""}"
                style="top:${this._height * this.playheadFrac}px"
              >
                ${s ? "LIVE" : r}
              </div>` : b}
          ${this._hoverGap ? p`<div class="gap-tip" style="top:${this._hoverGap.y}px">
                Camera offline
                <div class="gap-sub">
                  ${this._fmt(this._hoverGap.gap.start, { hour: "2-digit", minute: "2-digit" })} –
                  ${this._fmt(this._hoverGap.gap.end, { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>` : b}
          ${this.zoomUi ? this._renderZoom(a) : b}
          ${this.liveArrow && !this.live ? p`<button
                class="live-arrow"
                title="Jump to live"
                @pointerdown=${(d) => d.stopPropagation()}
                @click=${this._goLive}
              >
                ↑
              </button>` : b}
        </div>
      </div>
    `;
  }
  /** True when a visible thumbnail crosses the playhead pill's row, so the pill
   *  should step left of the thumbnail column instead of colliding with it.
   *  Measured against the ENLARGED thumbnail height (plus a margin), so a thumb
   *  growing under the playhead or on hover can't reach the pill either. */
  _pillDodge() {
    if (!this.mirror || !this._height) return !1;
    const e = this._playheadY, t = this.thumbSizeActive * 0.75 / 2 + 25;
    return this._kept.some((i) => Math.abs(i.y - e) < t);
  }
  /** The collapsible zoom control (magnifier fab -> vertical slider flyout).
   *  Dropped entirely in the fullscreen overlay, which has no zoom. */
  _renderZoom(e) {
    return p`
      ${this._zoomOpen ? p`<div class="zoom-panel">
            <button
              class="zpbtn"
              @pointerdown=${(t) => t.stopPropagation()}
              @click=${this._zoomIn}
              title="Zoom in"
            >
              +
            </button>
            <div
              class="zslider"
              @pointerdown=${this._onZoomSliderDown}
              @pointermove=${this._onZoomSliderMove}
              @pointerup=${this._onZoomSliderUp}
              @pointercancel=${this._onZoomSliderUp}
            >
              <div class="zthumb" style="top:calc(8px + ${e} * (100% - 16px))"></div>
            </div>
            <button
              class="zpbtn"
              @pointerdown=${(t) => t.stopPropagation()}
              @click=${this._zoomOut}
              title="Zoom out"
            >
              −
            </button>
          </div>` : p`<button
            class="zoom-fab"
            @pointerdown=${(t) => t.stopPropagation()}
            @click=${this._openZoom}
            title="Zoom"
          >
            <ha-icon icon="mdi:magnify-plus-outline"></ha-icon>
          </button>`}
    `;
  }
  _members() {
    if (this._flatMembers?.bands !== this.bands) {
      const e = [];
      for (const t of this.bands) for (const i of t.members ?? [t]) e.push({ m: i, g: t });
      e.sort((t, i) => t.m.start - i.m.start), this._flatMembers = { bands: this.bands, flat: e };
    }
    return this._flatMembers.flat;
  }
  /** Inline thumbnails: one per raw NVR event (group member) along its group's
   *  bar. Which thumbs EXIST is decided purely by geometry — greedy OLDEST-
   *  first (so a dense merged group is represented by its EARLIEST member,
   *  which plays the activity from the start), keeping a thumb only when it
   *  clears the previous kept one by an ENLARGED-vs-inactive height — so
   *  nothing can ever overlap OR need hiding: the active/hovered thumb grows
   *  in place without touching its neighbours, and, like UniFi, a hidden
   *  thumbnail STAYS hidden until you zoom in.
   *  Rendered keyed by event id so a thumb entering/leaving the viewport never
   *  rebinds another thumb's <img> (that rebinding read as content "flicker"
   *  while scrubbing).
   *  A thumbnail never swallows the pointerdown — the press has to reach the
   *  .scrub gestures so a drag starting on it still scrubs — and a TAP on one
   *  winds the timeline to that event from _onPointerUp instead. */
  _renderThumbs() {
    if (!this._height || !this.domain) return b;
    const e = P(this.domain, this.playheadFrac), t = this.thumbSizeActive * 0.75 / 2, i = this.thumbSize * 0.75 / 2, s = t + i + 6, r = M(this._dd), o = this._keptSel;
    let n;
    if (o && o.bands === this.bands && o.span === r && o.height === this._height && o.spacing === s)
      n = o.sel;
    else {
      n = [];
      let l = 1 / 0;
      for (const { m: _, g: v } of this._members()) {
        const y = (this._timeToY(_.end) + this._timeToY(_.start)) / 2;
        l - y < s || (l = y, n.push({ m: _, g: v }));
      }
      this._keptSel = { bands: this.bands, span: r, height: this._height, spacing: s, sel: n };
    }
    const a = n.map(({ m: l, g: _ }) => ({
      m: l,
      g: _,
      y: (this._timeToY(l.end) + this._timeToY(l.start)) / 2
    }));
    this._kept = a;
    let h, u = 1 / 0;
    for (const l of a) {
      if (e < l.g.start || e > l.g.end) continue;
      const _ = e < l.m.start ? l.m.start - e : e > l.m.end ? e - l.m.end : 0;
      _ < u && (u = _, h = l);
    }
    const d = a.filter((l) => {
      const _ = l === h || this._hoverBand === l.m ? t : i;
      return l.y + _ >= 0 && l.y - _ <= this._height;
    });
    return se(
      d,
      (l) => Ot(l.m),
      (l) => {
        const _ = l === h, v = this._hoverBand === l.m, y = this.loader?.get(l.m);
        return p`<div
          class="evt ${_ ? "active" : ""} ${v ? "hovered" : ""}"
          style="top:${l.y}px"
        >
          <span class="evt-line"></span>
          <div
            class="evt-wrap"
            data-key=${Ot(l.m)}
            @mouseenter=${() => this._setHover(l.m)}
            @mouseleave=${this._clearHover}
          >
            ${y ? p`<img class="evt-thumb" .src=${y} alt=${l.g.label} />` : p`<span class="evt-thumb evt-ph"></span>`}
          </div>
        </div>`;
      }
    );
  }
};
w.styles = rt`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      overflow: visible;
    }
    .col {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 6px;
    }
    /* Collapsed zoom control: a round magnifier button at the top-right of the
       timeline (same right-edge column as the jump-to-live arrow, but at the
       top). Tapping it expands .zoom-panel; tapping anywhere outside closes. */
    .zoom-fab {
      position: absolute;
      top: 14px;
      right: 8px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      z-index: 9;
      -webkit-tap-highlight-color: transparent;
    }
    .zoom-fab ha-icon {
      --mdc-icon-size: 24px;
      display: block;
    }
    /* Expanded zoom flyout: vertical slider pill, + on top, − at the bottom
       (UniFi mobile; plain glyphs — the loupe icons read too small). Fully
       custom slider — native vertical range inputs are unreliable on iOS. */
    .zoom-panel {
      position: absolute;
      top: 14px;
      right: 8px;
      width: 44px;
      /* A FIXED length, not a percentage of the ruler: this is one control and
         it must be the same size wherever it appears, but the card column's
         ruler and the fullscreen one are wildly different heights, so a
         percentage made the in-card flyout markedly the smaller of the two.
         224px is what 35% used to resolve to on a tablet's fullscreen ruler,
         so the overlay there is unchanged and the card column now matches it. */
      height: 224px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 0;
      box-sizing: border-box;
      border-radius: 22px;
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
      z-index: 9;
    }
    .zpbtn {
      flex: 0 0 auto;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      font-weight: 400;
      line-height: 1;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    .zslider {
      position: relative;
      flex: 1 1 auto;
      width: 100%;
      min-height: 60px;
      cursor: pointer;
      touch-action: none;
    }
    .zslider::before {
      /* the thin track line */
      content: '';
      position: absolute;
      left: 50%;
      top: 8px;
      bottom: 8px;
      width: 4px;
      transform: translateX(-50%);
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.25);
    }
    .zthumb {
      position: absolute;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 22px;
      height: 16px;
      border-radius: 5px;
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.45);
      pointer-events: none;
    }
    .scrub {
      position: relative;
      flex: 1 1 auto;
      min-height: 140px;
      overflow: visible;
      /* Clip thumbnails to the track's TOP/BOTTOM so they roll out gradually
         (like the canvas ticks/bars), while the big negative left/right outset
         leaves the enlarged thumbnail free to overflow sideways over the video. */
      clip-path: inset(0 -100vw 0 -100vw);
      touch-action: none;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      cursor: grab;
      background: var(--upc-track-bg, var(--card-background-color, #111));
      border-radius: 8px;
    }
    /* Fullscreen overlay: the strip floats ON the video, so it brings no
       background of its own (the host supplies the scrim gradient). Everything
       it draws runs edge to edge over the picture, so without a mask it ends in
       a hard cut at the top and bottom; fade both ends out instead. The gradient
       is resolved ONCE on the host (so --upc-fs-fade is picked up from whichever
       host rule wins) and reused by every layer that has to fade in step: the
       ruler canvas and the thumbnail layer. (calc() sits in a LENGTH position
       here, not inside a color function, so it is safe on the old tablet
       WebView.) */
    :host([mirror]) {
      --upc-fs-fade: 60px;
      --upc-fade-mask: linear-gradient(
        to bottom,
        transparent 0,
        #000 var(--upc-fs-fade),
        #000 calc(100% - var(--upc-fs-fade)),
        transparent 100%
      );
    }
    /* Shorter fade on a phone — the ruler is a fraction of the short side of a
       rotated screen, so the tablet's band would eat a fifth of it at each end. */
    :host([mirror][compact]) {
      --upc-fs-fade: 20px;
    }
    /* Masking these two and not .scrub is deliberate — the LIVE pill, the zoom
       control and the jump-to-live arrow are siblings inside .scrub; the arrow
       rides 8px off its bottom edge, i.e. right in the fade band, and both round
       buttons sit OUTSIDE .scrub's box (negative right), which a mask would clip
       away entirely. */
    :host([mirror]) canvas,
    :host([mirror]) .evt-layer {
      -webkit-mask-image: var(--upc-fade-mask);
      mask-image: var(--upc-fade-mask);
    }
    :host([mirror]) canvas {
      background: transparent;
      border-radius: 0;
    }
    :host([mirror]) .col {
      gap: 0;
    }
    :host([mirror]) .scrub {
      min-height: 0;
    }
    canvas:active {
      cursor: grabbing;
    }
    /* UniFi-style LIVE pill on the playhead while the live stream is showing.
       Anchored by --upc-pill-left (pillIndent), NOT --upc-indent: the timeline
       ruler can be shifted without dragging the pill along. */
    .live-pill {
      position: absolute;
      left: calc(4px + var(--upc-pill-left, 0px));
      transform: translateY(-50%);
      /* The DEEP accent, matching the overlay. The plain accent is tuned for
         thin lines on the ruler; behind white text it is too bright to read. */
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 3px 12px;
      border-radius: 7px;
      pointer-events: none;
      /* Anchored by its RIGHT edge inside a narrow column, so without this a
         clock time wraps onto two lines instead of overhanging to the left. */
      white-space: nowrap;
      z-index: 5;
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.45);
      /* Fade in when it first appears (e.g. switching back to Timeline) rather
         than snapping in — it's only rendered once the canvas height is
         measured, so it never flashes at the top first. */
      animation: upc-pill-in 0.35s ease both;
    }
    /* Same pill, off the live edge: the playhead's clock time. Identical accent
       to LIVE — it is the same marker in another state, and swapping its color
       under you reads as a different control. Tabular figures so the seconds
       ticking over don't jiggle its width. */
    :host([mirror]) .live-pill.at-time {
      font-size: 16px;
      letter-spacing: 0.2px;
    }
    /* Tabular figures everywhere the pill shows a clock: without them the
       seconds ticking over jiggle its width, and the swell below makes any
       jitter far more obvious. */
    .live-pill.at-time {
      font-variant-numeric: tabular-nums;
    }
    /* The swell itself lives further down, after every other pill rule — see
       "PILL SWELL". Putting it here would lose to the [mirror] and
       [mirror][compact] sizes, which are more specific or simply later. */
    /* Phone: the strip is a fraction of the short side of a rotated screen, and
       the picture is held at arm's length — scale the chrome down to match. */
    :host([mirror][compact]) .live-pill {
      font-size: 13px;
      padding: 4px 11px;
      border-radius: 8px;
    }
    :host([mirror][compact]) .live-pill.at-time {
      font-size: 14px;
    }
    :host([mirror][compact]) .live-arrow,
    :host([mirror][compact]) .zoom-fab {
      width: 38px;
      height: 38px;
    }
    :host([mirror][compact]) .live-arrow {
      font-size: 19px;
    }
    :host([mirror][compact]) .zoom-fab ha-icon {
      --mdc-icon-size: 21px;
    }
    /* Phone-sized flyout — shorter than the tablet's, since it has to fit a
       rotated phone's short side. The compact flag is set for the whole phone
       layout, not just its overlay, so the card column gets the same control. */
    :host([compact]) .zoom-panel {
      height: 206px;
    }
    @keyframes upc-pill-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    /* "Camera offline" tip shown while hovering an unavailable-footage gap
       (UniFi's "Lost wired connection" tooltip). Anchored right of the track at
       the gap's vertical center. */
    .gap-tip {
      position: absolute;
      left: calc(${at}px + var(--upc-indent, 0px));
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.82);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.3;
      padding: 5px 9px;
      border-radius: 6px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 8;
      box-shadow: 0 1px 5px rgba(0, 0, 0, 0.5);
    }
    .gap-tip .gap-sub {
      font-weight: 400;
      opacity: 0.85;
    }
    /* The thumbnails get their own layer purely so the overlay can fade them
       with the SAME mask as the ruler: masking each thumbnail individually would
       fade every picture into itself, where what's wanted is a fade by POSITION
       on the strip. The layer is the exact box .scrub is, so every .evt keeps its
       containing block, offsets and animations unchanged. Transparent to
       hit-testing — gestures are bound to .scrub and .evt-wrap opts back in. */
    .evt-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    /* Only the overlay's mask makes this a stacking context, so the card column
       keeps .evt's own z-indexes exactly as they were. 4 is .evt's base: it holds
       the whole layer above the LIVE pill (3) and below the gap tip (8) and the
       round buttons (9/10) — where the thumbnails already sat. */
    :host([mirror]) .evt-layer {
      z-index: 4;
    }
    /* Inline event thumbnail: dot (on the track, canvas) — line — image.
       The image itself is interactive (hover), but drag/scroll bubble to .scrub
       so scrolling over a thumbnail still pans the timeline. */
    .evt {
      position: absolute;
      left: calc(${at}px + var(--upc-indent, 0px));
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      pointer-events: none;
      z-index: 4;
    }
    .evt-line {
      width: 14px;
      height: 2px;
      flex: 0 0 auto;
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      opacity: 0.6;
    }
    .evt-wrap {
      position: relative;
      pointer-events: auto;
    }
    .evt-thumb {
      width: var(--upc-thumb-w, 79px);
      height: calc(var(--upc-thumb-w, 79px) * 0.75); /* 4:3, explicit so it animates */
      object-fit: cover;
      border-radius: 5px;
      background: #000;
      display: block;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
      border: 1.5px solid transparent;
      will-change: width, height;
      /* Modern decelerate (easeOutQuint): width AND height ease together for a
         smooth proportional grow/shrink on hover or under the playhead. */
      transition:
        width 0.26s cubic-bezier(0.22, 1, 0.36, 1),
        height 0.26s cubic-bezier(0.22, 1, 0.36, 1),
        border-color 0.2s ease,
        box-shadow 0.26s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .evt-ph {
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      opacity: 0.5;
    }
    /* Enlarge when the event is under the playhead or hovered. */
    .evt.active .evt-thumb,
    .evt.hovered .evt-thumb {
      width: var(--upc-thumb-w-lg, 115px);
      height: calc(var(--upc-thumb-w-lg, 115px) * 0.75);
      border-color: var(--upc-accent, var(--primary-color, #03a9f4));
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
    }
    .evt.active,
    .evt.hovered {
      z-index: 7;
    }
    /* MIRRORED: everything that is anchored LEFT of the track in the normal
       layout hangs off the RIGHT edge instead (--upc-evt-right, measured in
       _draw), and the event's connector line runs from the thumbnail rightward
       toward the track. */
    :host([mirror]) .evt,
    :host([mirror]) .gap-tip {
      left: auto;
      right: var(--upc-evt-right, ${at}px);
    }
    :host([mirror]) .evt {
      flex-direction: row-reverse;
    }
    /* Bigger pill in the overlay — it is read across a room, not at desk
       distance like the card's own column. It rides at --upc-pill-right, which
       steps further left when a thumbnail shares its row (see _pillDodge). */
    :host([mirror]) .live-pill {
      left: auto;
      right: var(--upc-pill-right, ${at}px);
      font-size: 15px;
      padding: 5px 14px;
      border-radius: 9px;
      /* Under every thumbnail (which sit at 4, or 7 while active/hovered): the
         dodge keeps them apart, and if they ever do meet, the picture wins. */
      z-index: 3;
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
      /* iOS-style: overshoots a touch and settles, rather than easing flatly. */
      transition: right 0.3s cubic-bezier(0.3, 1.8, 0.5, 1);
    }
    /* The playhead line continues from the pill back to the ruler, however far
       out the pill has stepped: the canvas draws it across the strip, this
       covers the rest. Same accent + thickness, so the join is invisible. */
    :host([mirror]) .live-pill::after {
      content: '';
      position: absolute;
      left: 100%;
      top: 50%;
      width: var(--upc-pill-right, 0px);
      height: 3px;
      transform: translateY(-50%);
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      /* Must match the pill's transition exactly or the line lags behind it. */
      transition: width 0.3s cubic-bezier(0.3, 1.8, 0.5, 1);
    }
    /* ---- PILL SWELL --------------------------------------------------------
       While the ruler is MOVING under the user — drag, flick glide, thumbnail
       seek, skip-button glide — the pill grows to what the on-video timestamp
       used to be. That stamp is gone: on a phone and on a small tablet the
       control bar sat right on top of it, and the pill already says the same
       thing. So this is now the ONLY readout of the moment being scrubbed to,
       and it has to be legible at arm's length.
       In the overlay it grows to the LEFT (it is right-anchored) — away from
       the screen edge and out over the video, which .scrub's negative inset
       clip-path already allows, so nothing clips and no offset has to change.
       Padding and radius scale with the text so the pill stays wrapped around
       it, and every property eases on the pill's own overshoot-and-settle
       curve. Must come after ALL the size rules above: [mirror] and
       [mirror][compact] would otherwise win on specificity or order. */
    .live-pill {
      transition:
        font-size 0.3s cubic-bezier(0.3, 1.8, 0.5, 1),
        padding 0.3s cubic-bezier(0.3, 1.8, 0.5, 1),
        border-radius 0.3s cubic-bezier(0.3, 1.8, 0.5, 1);
    }
    :host([mirror]) .live-pill {
      transition:
        right 0.3s cubic-bezier(0.3, 1.8, 0.5, 1),
        font-size 0.3s cubic-bezier(0.3, 1.8, 0.5, 1),
        padding 0.3s cubic-bezier(0.3, 1.8, 0.5, 1),
        border-radius 0.3s cubic-bezier(0.3, 1.8, 0.5, 1);
    }
    /* The card column is narrower than the overlay, so it takes a smaller
       swell — big enough to read while dragging without overrunning the
       column's width. */
    .live-pill.big,
    .live-pill.at-time.big {
      font-size: 20px;
      padding: 6px 15px;
      border-radius: 11px;
    }
    /* Fullscreen, phone and tablet alike: exactly the 26px the stage timestamp
       used to be. */
    :host([mirror]) .live-pill.big,
    :host([mirror]) .live-pill.at-time.big,
    :host([mirror][compact]) .live-pill.big,
    :host([mirror][compact]) .live-pill.at-time.big {
      font-size: 26px;
      padding: 8px 18px;
      border-radius: 13px;
    }
    /* Fullscreen overlay: the zoom control and the jump-to-live arrow share the
       clear lane between the ruler and the screen edge — zoom at the top, arrow
       at the bottom, both centered in it (--upc-fab-right is negative: they sit
       OUTSIDE the ruler's own box). */
    /* Level with the playhead pill rather than at the top of the strip, so the
       two controls read as one row across the timeline; the flyout opens
       downward from there. */
    :host([mirror]) .zoom-fab,
    :host([mirror]) .zoom-panel {
      right: var(--upc-fab-right, 8px);
      top: calc(var(--upc-ph-y, 36px) - 22px);
    }
    :host([mirror][compact]) .zoom-fab,
    :host([mirror][compact]) .zoom-panel {
      top: calc(var(--upc-ph-y, 33px) - 19px);
    }
    :host([mirror]) .zoom-fab {
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
    }
    :host([mirror]) .live-arrow {
      position: absolute;
      right: var(--upc-fab-right, 8px);
      bottom: 8px;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 22px;
      line-height: 1;
      /* Accent, like the LIVE pill it takes you back to — not the card's dark
         --upc-arrow, which is meant to read against the timeline column. */
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      z-index: 10;
      -webkit-tap-highlight-color: transparent;
    }
  `;
w._redrawProps = [
  "domain",
  "bands",
  "gaps",
  "gapColor",
  "now",
  "fontSize",
  "fontColor",
  "tickColor",
  "tickSize",
  "accentColor",
  "recordedColor",
  "futureColor",
  "indent"
];
x([
  c({ attribute: !1 })
], w.prototype, "domain", 2);
x([
  c({ attribute: !1 })
], w.prototype, "bands", 2);
x([
  c({ attribute: !1 })
], w.prototype, "gaps", 2);
x([
  c()
], w.prototype, "gapColor", 2);
x([
  c({ attribute: !1 })
], w.prototype, "now", 2);
x([
  c({ attribute: !1 })
], w.prototype, "hass", 2);
x([
  c()
], w.prototype, "nvrId", 2);
x([
  c()
], w.prototype, "cameraId", 2);
x([
  c({ type: Number })
], w.prototype, "fontSize", 2);
x([
  c()
], w.prototype, "fontColor", 2);
x([
  c()
], w.prototype, "accentColor", 2);
x([
  c()
], w.prototype, "tickColor", 2);
x([
  c({ type: Number })
], w.prototype, "tickSize", 2);
x([
  c()
], w.prototype, "recordedColor", 2);
x([
  c()
], w.prototype, "futureColor", 2);
x([
  c({ type: Number })
], w.prototype, "thumbSize", 2);
x([
  c({ type: Number })
], w.prototype, "thumbSizeActive", 2);
x([
  c({ attribute: !1 })
], w.prototype, "loader", 2);
x([
  c({ type: Number })
], w.prototype, "thumbVersion", 2);
x([
  c({ type: Boolean })
], w.prototype, "live", 2);
x([
  c({ type: Boolean })
], w.prototype, "livePaused", 2);
x([
  c({ type: Number })
], w.prototype, "indent", 2);
x([
  c({ type: Number })
], w.prototype, "pillIndent", 2);
x([
  c({ type: Boolean, reflect: !0 })
], w.prototype, "mirror", 2);
x([
  c({ type: Boolean })
], w.prototype, "zoomUi", 2);
x([
  c({ type: Boolean })
], w.prototype, "rotated", 2);
x([
  c({ type: Boolean })
], w.prototype, "liveArrow", 2);
x([
  c({ type: Boolean, reflect: !0 })
], w.prototype, "compact", 2);
x([
  c({ type: Number })
], w.prototype, "playheadFrac", 2);
x([
  c({ type: Number })
], w.prototype, "gutter", 2);
x([
  m()
], w.prototype, "_hoverBand", 2);
x([
  m()
], w.prototype, "_hoverGap", 2);
x([
  m()
], w.prototype, "_zoomOpen", 2);
x([
  G("canvas")
], w.prototype, "_canvas", 2);
x([
  G(".scrub")
], w.prototype, "_scrubEl", 2);
x([
  m()
], w.prototype, "_pillBig", 2);
w = x([
  ot("upc-scrubber-timeline")
], w);
var Ms = Object.defineProperty, As = Object.getOwnPropertyDescriptor, C = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? As(t, i) : t, o = e.length - 1, n; o >= 0; o--)
    (n = e[o]) && (r = (s ? n(t, i, r) : n(r)) || r);
  return s && r && Ms(t, i, r), r;
};
let E = class extends j {
  constructor() {
    super(...arguments), this.bands = [], this.thumbVersion = 0, this.textSize = 12, this.textColor = "", this.durationSize = 12, this.durationColor = "", this.activeTextSize = 12, this.activeTextColor = "#000", this.activeDurationSize = 12, this.activeDurationColor = "#000", this.activeBg = "#fff", this.playingKey = "", this.dateFontSize = 13, this.dateFontColor = "", this.dividerColor = "", this.thumbWidth = 104, this.showCamera = !1, this.line1White = !1, this._requested = /* @__PURE__ */ new Set(), this._bandByKey = /* @__PURE__ */ new Map();
  }
  connectedCallback() {
    super.connectedCallback(), this.hasUpdated && !this._io && this._setupObserver();
  }
  firstUpdated() {
    this._setupObserver();
  }
  _setupObserver() {
    this._io = new IntersectionObserver((e) => this._onIntersect(e), {
      root: this._listEl ?? null,
      rootMargin: "300px 0px"
    }), this._observeRows();
  }
  updated() {
    this._observeRows();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._io?.disconnect(), this._io = void 0;
  }
  /** A row scrolled into view -> request its thumbnail (once). */
  _onIntersect(e) {
    let t = !1;
    for (const i of e) {
      if (!i.isIntersecting) continue;
      const s = i.target.dataset.key;
      if (!s || this._requested.has(s)) continue;
      this._requested.add(s);
      const r = this._bandByKey.get(s);
      r && this.loader?.get(r), this._io?.unobserve(i.target), t = !0;
    }
    t && this.requestUpdate();
  }
  _observeRows() {
    this._io && this.renderRoot.querySelectorAll(".thumb[data-key]").forEach((e) => {
      const t = e.dataset.key;
      this._requested.has(t) || this._io.observe(e);
    });
  }
  // PERF-SCRUB-2026-08-03: memoised formatters — one per rendered row before.
  // Revert: inline `new Intl.DateTimeFormat(undefined, {...}).format(new Date(t))`.
  _fmtTime(e) {
    return ht(e, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
  _fmtDay(e) {
    return ht(e, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  }
  _sameDay(e, t) {
    const i = new Date(e), s = new Date(t);
    return i.getFullYear() === s.getFullYear() && i.getMonth() === s.getMonth() && i.getDate() === s.getDate();
  }
  _fmtDur(e) {
    const t = Math.max(1, Math.round(e / 1e3));
    if (t < 60) return `${t}s`;
    const i = Math.floor(t / 60), s = t % 60;
    return s ? `${i}m ${s}s` : `${i}m`;
  }
  _play(e) {
    this.dispatchEvent(
      new CustomEvent("event-selected", { detail: e, bubbles: !0, composed: !0 })
    );
  }
  /** Scroll so the given day's section starts at the top of the list. Called
   *  by the card when a calendar day is picked while the Events view is open.
   *  The whole event window is always rendered, so the target row exists; a
   *  day with no events scrolls to where it would be (the next older row). */
  /** Bring one event's row into view, centred in the list. Returns false when
   *  this list does not hold that event. Used when coming back from a clip's
   *  fullscreen hand-off, so the row that was playing is in front of you. */
  revealKey(e) {
    if (!e) return !1;
    const i = this.renderRoot.querySelector(`.thumb[data-key="${CSS.escape(e)}"]`)?.closest("button");
    return i ? (i.scrollIntoView({ block: "center", inline: "nearest" }), !0) : !1;
  }
  scrollToDay(e) {
    const t = e + 864e5, i = [...this.bands].sort((a, h) => h.start - a.start).find((a) => a.start < t);
    if (!i || !this._listEl) return;
    const r = this.renderRoot.querySelector(`.thumb[data-key="${i.type}@${i.start}"]`)?.closest(".row");
    if (!r) return;
    const o = r.previousElementSibling, n = o?.classList.contains("day-divider") ? o : r;
    this._listEl.scrollTop = n.offsetTop;
  }
  render() {
    const e = [...this.bands].sort((i, s) => s.start - i.start), t = `--list-size:${this.textSize}px;--list-dur-size:${this.durationSize}px;--list-active-size:${this.activeTextSize}px;--list-active-dur-size:${this.activeDurationSize}px;--list-active-color:${this.activeTextColor};--list-active-dur-color:${this.activeDurationColor};--list-active-bg:${this.activeBg};--list-thumb-w:${this.thumbWidth}px;` + (this.dividerColor ? `--upc-divider:${this.dividerColor};` : "") + (this.textColor ? `--list-color:${this.textColor};` : "") + (this.durationColor ? `--list-dur-color:${this.durationColor};--list-dur-op:1;` : "");
    return this._bandByKey.clear(), p`
      <div class="list" style=${t}>
        ${e.length === 0 ? p`<div class="empty">No events in this range</div>` : se(
      e,
      (i) => `${i.type}@${i.start}`,
      (i, s) => {
        const r = `${i.type}@${i.start}`;
        this._bandByKey.set(r, i);
        const o = this._requested.has(r) ? this.loader?.get(i) : void 0, n = this.playingKey === r, a = i.ongoing ? "In progress" : this._fmtDur(i.durMs ?? i.end - i.start), h = this.showCamera && !!i.cameraName, u = h ? i.cameraName : this._fmtTime(i.start), d = h ? `${this._fmtTime(i.start)} · ${a}` : a, l = s === 0 || !this._sameDay(e[s - 1].start, i.start);
        return p`
                  ${l ? p`<div class="day-divider">
                        <span
                          class="day-label"
                          style="font-size:${this.dateFontSize}px;color:${this.dateFontColor || "#fff"}"
                          >${this._fmtDay(i.start)}</span
                        >
                      </div>` : b}
                  <button class="row ${n ? "playing" : ""}" @click=${() => this._play(i)}>
                    <div class="info">
                      <div class="t1">${u}</div>
                      <div class="t2">${d}</div>
                    </div>
                    <div class="thumb" data-key=${r}>
                      ${o ? p`<img src=${o} alt=${i.label} />` : p`<span class="ph"></span>`}
                    </div>
                  </button>
                `;
      }
    )}
      </div>
    `;
  }
};
E.styles = rt`
    :host {
      /* Fill the (position:relative) mode-body via absolute inset:0 rather than
         height:100%. This way the list can NEVER content-expand and blow up the
         card layout if an ancestor height is momentarily indefinite — it just
         fills whatever box it's given and scrolls internally. */
      display: block;
      position: absolute;
      inset: 0;
    }
    .list {
      height: 100%;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      scrollbar-width: none; /* Firefox: hide scrollbar, keep scrolling */
      -ms-overflow-style: none;
    }
    .list::-webkit-scrollbar {
      width: 0;
      height: 0;
      display: none;
    }
    .empty {
      color: var(--secondary-text-color);
      padding: 16px 8px;
      text-align: center;
    }
    /* Day separator between events from different days: a 1px grey rule with the
       date centered in the middle. */
    .day-divider {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px 4px;
    }
    .day-divider::before,
    .day-divider::after {
      content: '';
      flex: 1 1 auto;
      height: 1px;
      background: var(--upc-divider, var(--divider-color, rgba(255, 255, 255, 0.15)));
    }
    .day-label {
      flex: 0 0 auto;
      font-weight: 600;
      white-space: nowrap;
    }
    .row {
      display: flex;
      align-items: stretch;
      gap: 6px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 8px 4px;
      text-align: left;
      border-radius: 8px;
      /* Default inactive grey — a light grey (lighter than the theme's
         --secondary-text-color ~#b0), matching the timeline's label color. */
      color: var(--list-color, #d0d0d0);
      font-family: inherit;
    }
    .row:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    /* The currently-playing row: fully independent active styling. */
    .row.playing {
      background: var(--list-active-bg, #fff);
    }
    .row.playing .t1 {
      font-size: var(--list-active-size, 12px);
      color: var(--list-active-color, #000);
    }
    .row.playing .t2 {
      font-size: var(--list-active-dur-size, 12px);
      color: var(--list-active-dur-color, #000);
      opacity: 1;
    }
    .info {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      padding-left: 4px; /* breathing room now the left bar is gone */
    }
    .t1 {
      font-size: var(--list-size, 12px);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .t2 {
      font-size: var(--list-dur-size, 12px);
      /* Defaults to the time color (inherited), dimmed; full color if set. */
      color: var(--list-dur-color, currentColor);
      opacity: var(--list-dur-op, 0.7);
      white-space: nowrap;
    }
    /* Prominent first line (multi list + timeline): line 1 white, line 2 full
       opacity — matching the expanded grid captions exactly. Only the inactive
       rows; the playing row keeps its active colors. */
    :host([line1white]) .row:not(.playing) .t1 {
      color: #fff;
    }
    :host([line1white]) .t2 {
      opacity: 1;
    }
    .thumb {
      flex: 0 0 auto;
      width: var(--list-thumb-w, 104px);
      aspect-ratio: 16 / 10;
      border-radius: 6px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    }
    .thumb img,
    .thumb .ph {
      width: 100%;
      height: 100%;
      display: block;
    }
    .thumb img {
      object-fit: cover;
    }
    .thumb .ph {
      background: var(--divider-color, rgba(255, 255, 255, 0.1));
    }
  `;
C([
  c({ attribute: !1 })
], E.prototype, "bands", 2);
C([
  c({ attribute: !1 })
], E.prototype, "loader", 2);
C([
  c({ type: Number })
], E.prototype, "thumbVersion", 2);
C([
  c({ type: Number })
], E.prototype, "textSize", 2);
C([
  c()
], E.prototype, "textColor", 2);
C([
  c({ type: Number })
], E.prototype, "durationSize", 2);
C([
  c()
], E.prototype, "durationColor", 2);
C([
  c({ type: Number })
], E.prototype, "activeTextSize", 2);
C([
  c()
], E.prototype, "activeTextColor", 2);
C([
  c({ type: Number })
], E.prototype, "activeDurationSize", 2);
C([
  c()
], E.prototype, "activeDurationColor", 2);
C([
  c()
], E.prototype, "activeBg", 2);
C([
  c()
], E.prototype, "playingKey", 2);
C([
  c({ type: Number })
], E.prototype, "dateFontSize", 2);
C([
  c()
], E.prototype, "dateFontColor", 2);
C([
  c()
], E.prototype, "dividerColor", 2);
C([
  c({ type: Number })
], E.prototype, "thumbWidth", 2);
C([
  c({ type: Boolean, reflect: !0 })
], E.prototype, "showCamera", 2);
C([
  c({ type: Boolean, reflect: !0 })
], E.prototype, "line1White", 2);
C([
  G(".list")
], E.prototype, "_listEl", 2);
E = C([
  ot("upc-events-list")
], E);
const oi = typeof navigator < "u" && /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|Android/.test(navigator.userAgent);
function Cs(e, t, i, s) {
  return i || t === "muted" ? !1 : e === "auto" || t === "unmuted";
}
const Ae = 6e4, Fs = 1e4, zs = 5e3, Rs = 5e3, Ls = 8e3, Ds = 15e3, Os = 400, Is = 15, Bs = 25 * 6e4, Ns = 5 * 6e4, Us = 16, Vs = 6, Hs = 2;
function Ws(e, t, i) {
  return e ? [i ? "fast" : void 0, t ? "fine" : void 0].filter(
    (s) => !!s
  ) : [t ? "fine" : void 0, i ? "fast" : void 0].filter(
    (s) => !!s
  );
}
class js {
  constructor() {
    this._dir = "", this._blocks = /* @__PURE__ */ new Set(), this._blockMs = 6e5, this._overview = /* @__PURE__ */ new Set(), this._overviewMs = 36e5, this._mapped = /* @__PURE__ */ new Set(), this._indexAt = 0, this._blobs = /* @__PURE__ */ new Map(), this._loading = /* @__PURE__ */ new Map(), this._maps = /* @__PURE__ */ new Map(), this._lastSync = 0, this._pinned = /* @__PURE__ */ new Set(), this._warnedNoHeadFile = !1, this._spriteBlocks = /* @__PURE__ */ new Set(), this._spriteOverview = /* @__PURE__ */ new Set(), this._fastSpriteBlocks = /* @__PURE__ */ new Set(), this._fastSpriteOverview = /* @__PURE__ */ new Set(), this._sprites = /* @__PURE__ */ new Map(), this._spriteLoading = /* @__PURE__ */ new Map(), this._fastSprites = /* @__PURE__ */ new Map(), this._fastSpriteLoading = /* @__PURE__ */ new Map(), this._sheets = /* @__PURE__ */ new Map(), this._sheetLoading = /* @__PURE__ */ new Map(), this._sheetAborts = /* @__PURE__ */ new Map(), this._sheetInflight = 0, this._tipAt = 0, this._tipReqAt = 0, this._tipPolling = !1, this._tipEnabled = !1, this._mapLoading = /* @__PURE__ */ new Map();
  }
  /** Point the loader at a camera's cache dir; a dir change drops everything. */
  configure(t, i) {
    this._hass = t, i !== this._dir && (this._dir = i, this._reset());
  }
  destroy() {
    this._reset();
  }
  _reset() {
    for (const t of this._blobs.values()) URL.revokeObjectURL(t);
    this._blobs.clear(), this._loading.clear(), this._blocks.clear(), this._overview.clear(), this._maps.clear(), this._mapped.clear(), this._head = void 0, this._headHeld = void 0, this._tip = void 0, this._tipHeld = void 0, this._tipAt = 0, this._tipReqAt = 0, this._pinned.clear(), this._indexAt = 0;
    for (const t of this._sheets.values()) t.close();
    this._sheets.clear(), this._sheetLoading.clear(), this._sprites.clear(), this._spriteLoading.clear(), this._fastSprites.clear(), this._fastSpriteLoading.clear(), this._spriteBlocks.clear(), this._spriteOverview.clear(), this._fastSpriteBlocks.clear(), this._fastSpriteOverview.clear();
  }
  // ---- sprite tier (SPRITE-PREVIEW-2026-08-04) ------------------------------
  /** Whether this unit was also published in the 640x360 fine JPEG tier.
   *  Only completed blocks and overview hours have fine sheets. */
  hasSprites(t) {
    return t.head || t.tip || t.part ? !1 : t.overview ? this._spriteOverview.has(t.start) : this._spriteBlocks.has(t.start);
  }
  /** Compact 480x270 coverage also includes each immutable rolling-head
   *  generation, allowing LIVE to prewarm first-scrub pixels without its MP4. */
  hasFastSprites(t) {
    return t.fastSprite ? !0 : t.overview ? this._fastSpriteOverview.has(t.start) : this._fastSpriteBlocks.has(t.start);
  }
  /** The sidecar if it is already in hand (synchronous — for "can I paint this
   *  unit right now?" checks that must not await). */
  spriteIfLoaded(t) {
    return this._sprites.get(t.key) ?? void 0;
  }
  fastSpriteIfLoaded(t) {
    return this._fastSprites.get(t.key) ?? void 0;
  }
  /** The sidecar for a unit — cached + deduped, exactly like getMap(). */
  async getSprite(t) {
    if (!this.hasSprites(t)) return;
    const i = this._sprites.get(t.key);
    if (i !== void 0) return i ?? void 0;
    let s = this._spriteLoading.get(t.key);
    return s || (s = this._fetchSprite(t).finally(() => this._spriteLoading.delete(t.key)), this._spriteLoading.set(t.key, s)), s;
  }
  async getFastSprite(t) {
    if (!this.hasFastSprites(t)) return;
    const i = this._fastSprites.get(t.key);
    if (i !== void 0) return i ?? void 0;
    let s = this._fastSpriteLoading.get(t.key);
    return s || (s = this._fetchSprite(t, !0).finally(() => this._fastSpriteLoading.delete(t.key)), this._fastSpriteLoading.set(t.key, s)), s;
  }
  async _fetchSprite(t, i = !1) {
    const s = i ? this._fastSprites : this._sprites, r = i ? ".fast-sprite.json" : ".sprite.json";
    try {
      const o = await fetch(t.url.replace(/\.mp4$/, r)), n = o.ok ? await o.json() : void 0;
      let a = null;
      return n?.version === 1 && n.count && n.cols && n.rows && n.tile_w && n.tile_h && Array.isArray(n.sheets) && n.sheets.length && (a = {
        count: n.count,
        cols: n.cols,
        rows: n.rows,
        tileW: n.tile_w,
        tileH: n.tile_h,
        sheets: n.sheets
      }), s.set(t.key, a), a ?? void 0;
    } catch {
      s.set(t.key, null);
      return;
    }
  }
  /** Tile index within the unit for `t`. `count - 1` is the last REAL frame:
   *  the trailing tiles of the final sheet are ffmpeg's padding and must never
   *  be shown. */
  tileIndexFor(t, i, s) {
    const r = t.end - t.start;
    if (r <= 0) return 0;
    const o = Math.min(1, Math.max(0, (s - t.start) / r));
    return Math.min(i.count - 1, Math.floor(o * i.count));
  }
  /** Which sheet a tile index lives in, and where inside it. */
  tileAt(t, i) {
    const s = t.cols * t.rows, r = Math.min(t.count - 1, Math.max(0, i)), o = t.sheets[Math.floor(r / s)];
    if (!o) return;
    const n = r % s;
    return { sheet: o, sx: n % t.cols * t.tileW, sy: Math.floor(n / t.cols) * t.tileH };
  }
  /** The footage time a tile represents (its centre), so a caller can tell
   *  whether one candidate frame is closer to the wanted time than another. */
  tileTime(t, i, s) {
    return t.start + (s + 0.5) / i.count * (t.end - t.start);
  }
  /** Which sheet (and where in it) shows `t` for a unit. */
  tileFor(t, i, s) {
    return this.tileAt(i, this.tileIndexFor(t, i, s));
  }
  /** Whether a sheet's bitmap is already decoded and resident. */
  hasSheet(t) {
    return this._sheets.has(t);
  }
  /** Abort every sheet download still in flight.
   *
   *  Called the moment a gesture ends. A fast drag queues a LOT of sheets and
   *  they keep arriving long after the user has gone back to LIVE — measured on
   *  one 0.5 s drag: 88 requests / 44 MB total, of which 37 requests / 27 MB
   *  landed AFTER the gesture had finished. The live HLS stream carries only a
   *  ~2 s buffer (PART-HOLD-BACK=2.0) at ~7 Mbps, so that tail starves it and
   *  live stutters for several seconds — which is exactly the regression this
   *  tier introduced. Nothing is lost by aborting: the sheets are immutable and
   *  long-cached, so anything genuinely needed later re-fetches (usually from
   *  the HTTP cache). */
  abortSheets() {
    for (const t of this._sheetAborts.values())
      try {
        t.abort();
      } catch {
      }
    this._sheetAborts.clear(), this._sheetLoading.clear(), this._sheetInflight = 0;
  }
  /** Decoded sheet bitmap — cached, deduped, LRU-bounded.
   *
   *  `prefetch` marks a speculative neighbour: those are DROPPED rather than
   *  queued when enough downloads are already in flight, so warming can never
   *  crowd out the sheet actually being shown (or the live stream). */
  async getSheet(t, i = !1) {
    const s = this._sheets.get(t);
    if (s)
      return this._sheets.delete(t), this._sheets.set(t, s), s;
    let r = this._sheetLoading.get(t);
    if (!r) {
      if (i && this._sheetInflight >= Hs) return;
      r = this._fetchSheet(t).finally(() => this._sheetLoading.delete(t)), this._sheetLoading.set(t, r);
    }
    return r;
  }
  async _fetchSheet(t) {
    const i = new AbortController();
    this._sheetAborts.set(t, i), this._sheetInflight++;
    try {
      const s = await fetch(`${this._dir}/${t}`, { signal: i.signal });
      if (!s.ok) return;
      const r = await createImageBitmap(await s.blob());
      for (this._sheets.set(t, r); this._sheets.size > Vs; ) {
        const o = this._sheets.keys().next().value;
        if (o === void 0 || o === t) break;
        const n = this._sheets.get(o);
        this._sheets.delete(o), n?.close();
      }
      return r;
    } catch {
      return;
    } finally {
      this._sheetAborts.delete(t), this._sheetInflight = Math.max(0, this._sheetInflight - 1);
    }
  }
  /** Blob URLs that are currently assigned to a mounted <video>. These are never
   *  evicted — revoking a URL under a live element makes it error to black. */
  setPinned(t) {
    this._pinned = new Set(t.filter((i) => !!i));
  }
  /** Refresh the index if due. Resolves once an attempt has completed (missing
   *  index just leaves the block set empty — the preview stays off).
   *
   *  Pass the scrub target so a time in the head region can trigger the shorter
   *  HEAD_TTL_MS refresh — fired but NOT awaited, so it only ever makes the next
   *  retarget fresher and never stalls this one. */
  async ensureIndex(t) {
    if (!this._dir) return;
    const i = Date.now() - this._indexAt;
    if (i < Ae) {
      const s = this._head;
      s && t !== void 0 && t >= s.start && i >= Fs && this._refreshIndex();
      return;
    }
    return this._refreshIndex();
  }
  _refreshIndex() {
    return this._indexLoading || (this._indexLoading = this._fetchIndex().finally(() => {
      this._indexLoading = void 0;
    })), this._indexLoading;
  }
  async _fetchIndex() {
    let t = !1, i = !0;
    try {
      const s = await fetch(`${this._dir}/index.json`, { cache: "no-cache" });
      if (s.ok) {
        const r = await s.json();
        if (Array.isArray(r.blocks)) {
          t = !0, this._blocks = new Set(r.blocks), this._mapped = new Set(r.maps ?? []), r.block_ms && r.block_ms > 0 && (this._blockMs = r.block_ms), this._overview = new Set(r.overview ?? []), this._spriteBlocks = new Set(r.sprites ?? []), this._spriteOverview = new Set(r.osprites ?? []), this._fastSpriteBlocks = new Set(r.fast_sprites ?? []), this._fastSpriteOverview = new Set(r.fast_osprites ?? []), r.overview_block_ms && r.overview_block_ms > 0 && (this._overviewMs = r.overview_block_ms);
          const o = r.head;
          this._head = o && typeof o.start == "number" && typeof o.end == "number" && o.end > o.start ? {
            start: o.start,
            end: o.end,
            map: !!o.map,
            file: o.file,
            fastSprite: !!o.fast_sprite
          } : void 0, this._head && !this._head.file && !this._warnedNoHeadFile && (this._warnedNoHeadFile = !0, console.warn(
            "[unifi-protect-timeline-card] scrub preview: protect_scrub.py is out of date (head has no immutable `file`) — near-live preview disabled. Update the pyscript job."
          )), i = Date.now() - (r.generated ?? 0) > Bs;
        }
      }
    } catch {
    }
    this._indexAt = t ? Date.now() : Date.now() - Math.max(0, Ae - zs), i && this._requestSync();
  }
  /** Ask protect_cache for a pass (throttled). It runs itself every 15 s, so
   *  a stale index means it is failing; the call at least records why. No-ops
   *  when protect_cache isn't installed — the card keeps a plain scrub stage. */
  _requestSync() {
    if (!this._hass) return;
    const t = Date.now();
    t - this._lastSync < Ns || (this._lastSync = t, this._hass.callWS({ type: "call_service", domain: "protect_cache", service: "scrub_sync" }).catch(() => {
    }));
  }
  /** The block covering `t`, if any. Completed blocks win; the rolling head
   *  covers everything from its start onward (times past its end clamp to the
   *  newest exported frame — that's the last ~minute behind live). */
  blockFor(t) {
    const i = Math.floor(t / this._blockMs) * this._blockMs;
    if (this._blocks.has(i))
      return {
        key: `b${i}`,
        start: i,
        end: i + this._blockMs,
        url: `${this._dir}/${i}.mp4`,
        mapped: this._mapped.has(i),
        fastSprite: this._fastSpriteBlocks.has(i)
      };
    const s = this._head;
    if (s && s.file && t >= s.start) {
      const r = this._headHeld;
      return r && r.start === s.start && t <= r.end && this._blobs.has(r.key) ? r : {
        // The filename carries the covered range, so it IS the identity.
        key: s.file,
        start: s.start,
        end: s.end,
        url: `${this._dir}/${s.file}`,
        head: !0,
        mapped: !!s.map,
        fastSprite: !!s.fastSprite
      };
    }
  }
  // ---- tip tier (EXPERIMENTAL) ---------------------------------------------
  /** Turn the on-demand tip on/off (card config `scrub_tip`). Off = nothing
   *  here ever runs: no service calls, no tip.json reads. */
  setTipEnabled(t) {
    this._tipEnabled = t, t || (this._tip = void 0);
  }
  /** The camera slug the pyscript service wants — the last path segment of the
   *  cache dir, which is the HA camera entity's object_id by construction. */
  _slug() {
    return this._dir.split("/").filter(Boolean).pop() ?? "";
  }
  /** Ask the NVR for a fresh clip of the newest ~minute, then poll for it.
   *  Called when a scrub STARTS near the live edge. Throttled; a no-op when
   *  the tip is disabled or pyscript isn't running the newer job. */
  requestTip() {
    if (!this._tipEnabled || !this._hass || !this._dir) return;
    const t = Date.now();
    t - this._tipReqAt < Ls || this._tip && this._tip.end > t - Ds || (this._tipReqAt = t, this._hass.callWS({
      type: "call_service",
      domain: "pyscript",
      service: "protect_scrub_tip",
      service_data: { slug: this._slug() }
    }).then(() => this._pollTip()).catch(() => {
    }));
  }
  /** Poll tip.json until the requested export shows up (~1.1s measured). */
  async _pollTip() {
    if (!this._tipPolling) {
      this._tipPolling = !0;
      try {
        const t = this._tip?.end ?? 0;
        for (let i = 0; i < Is; i++) {
          if (await new Promise((s) => setTimeout(s, Os)), !this._tipEnabled) return;
          if (await this._fetchTip(), (this._tip?.end ?? 0) > t) {
            this.onTipUpdate?.();
            return;
          }
        }
      } finally {
        this._tipPolling = !1;
      }
    }
  }
  /** Refresh tip.json if due (cheap: a few hundred bytes). */
  async ensureTip() {
    !this._tipEnabled || !this._dir || Date.now() - this._tipAt < Rs || await this._fetchTip();
  }
  async _fetchTip() {
    this._tipAt = Date.now();
    try {
      const t = await fetch(`${this._dir}/tip.json`, { cache: "no-store" });
      if (!t.ok) return;
      const i = await t.json();
      typeof i.start == "number" && typeof i.end == "number" && i.end > i.start && i.file && (this._tip = { start: i.start, end: i.end, file: i.file });
    } catch {
    }
  }
  /** The tip unit for `t`, when the tip is the best thing available.
   *
   *  Inside its own range it always wins: it is real-time (~30fps) where every
   *  other tier is a timelapse at one frame per 2.4s or worse. PAST its end it
   *  only wins while nothing fresher exists — once a cron head has caught up
   *  past it, clamping to a minutes-old tip frame would be worse than the head.
   *  `head` is the head's advertised end (0 when there is none). */
  tipBlockFor(t, i) {
    const s = this._tip;
    if (!this._tipEnabled || !s || t < s.start || t > s.end && s.end <= i) return;
    const r = {
      key: s.file,
      start: s.start,
      end: s.end,
      url: `${this._dir}/${s.file}`,
      tip: !0
    };
    if (this._blobs.has(r.key))
      return this._tipHeld = r, r;
    const o = this._tipHeld;
    return o && t >= o.start && this._blobs.has(o.key) && (t <= o.end || o.end > i) ? (this.getBlock(r).then((n) => {
      n && this.onTipUpdate?.();
    }), o) : r;
  }
  /** The head's advertised end, for tipBlockFor's freshness comparison. */
  headEnd() {
    return this._head?.end ?? 0;
  }
  /** Fine block length in ms (from index.json). PERF-SCRUB-2026-08-03: the
   *  media-view compares it against the scrub velocity to decide whether a fine
   *  unit could even be staged before the playhead has left it. */
  blockMs() {
    return this._blockMs;
  }
  /** The coarse overview unit covering `t`, if that hour has been exported.
   *  Never `mapped` (uniform density by construction at this speedup), so it is
   *  always directly playable — no sidecar round trip before a frame can show.
   *  Undefined inside the current incomplete hour; the fine blocks and the
   *  rolling head cover that region. */
  overviewBlockFor(t) {
    const i = Math.floor(t / this._overviewMs) * this._overviewMs;
    if (this._overview.has(i))
      return {
        key: `o${i}`,
        start: i,
        end: i + this._overviewMs,
        url: `${this._dir}/o${i}.mp4`,
        overview: !0
        // SPRITE-PREVIEW-2026-08-04
      };
  }
  async getMap(t) {
    if (!t.mapped) return;
    const i = this._maps.get(t.key);
    if (i !== void 0) return i ?? void 0;
    let s = this._mapLoading.get(t.key);
    return s || (s = this._fetchMap(t).finally(() => this._mapLoading.delete(t.key)), this._mapLoading.set(t.key, s)), s;
  }
  async _fetchMap(t) {
    try {
      const i = t.url.replace(/\.mp4$/, ".map.json"), s = await fetch(i, { cache: "no-cache" }), r = s.ok ? await s.json() : void 0;
      let o = null;
      return r?.version === 2 && Array.isArray(r.segments) && r.segments.length && (o = r.segments.filter((n) => typeof n?.f == "string" && n.e > n.s), o.length || (o = null)), this._maps.set(t.key, o), o ?? void 0;
    } catch {
      this._maps.set(t.key, null);
      return;
    }
  }
  /** Resolve a mapped block + time to the playable PART covering that time
   *  (a standalone small MP4 spanning exactly [s, e] — the <video> element's
   *  duration is the ground truth for the linear seek within it). Times in an
   *  unexported gap resolve to the nearest earlier part (its end frame).
   *  Neighbour parts are prefetched fire-and-forget. */
  async resolvePart(t, i) {
    const s = await this.getMap(t);
    if (!s) return;
    let r = 0;
    for (let o = 0; o < s.length && i >= s[o].s; o++)
      r = o;
    for (const o of [r - 1, r + 1])
      o >= 0 && o < s.length && this.getBlock(this._partBlock(t, s[o]));
    return this._partBlock(t, s[r]);
  }
  _partBlock(t, i) {
    return {
      // Part filenames embed their unit's stem — including the head generation's
      // — so the name alone is unique and immutable for heads and blocks alike.
      key: `p${i.f}`,
      start: i.s,
      end: i.e,
      url: `${this._dir}/${i.f}`,
      head: t.head,
      part: !0
    };
  }
  /** Whether a block's bytes are already held as a blob (no fetch needed). */
  isCached(t) {
    return this._blobs.has(t.key);
  }
  /** blob: URL for a block — cached, deduped; undefined if the fetch fails. */
  async getBlock(t) {
    const i = this._blobs.get(t.key);
    if (i)
      return this._blobs.delete(t.key), this._blobs.set(t.key, i), i;
    let s = this._loading.get(t.key);
    return s || (s = this._fetchBlock(t).finally(() => this._loading.delete(t.key)), this._loading.set(t.key, s)), s;
  }
  async _fetchBlock(t) {
    try {
      const i = await fetch(t.url);
      if (!i.ok) {
        t.head && (this._indexAt = 0);
        return;
      }
      const s = await i.blob(), r = URL.createObjectURL(s);
      for (this._blobs.set(t.key, r), t.head && !t.part && (this._headHeld = t); this._blobs.size > Us; ) {
        let o = !1;
        for (const [n, a] of this._blobs)
          if (!this._pinned.has(a)) {
            this._blobs.delete(n), URL.revokeObjectURL(a), o = !0;
            break;
          }
        if (!o) break;
      }
      return r;
    } catch {
      return;
    }
  }
}
function At(e) {
  try {
    e.pause();
  } catch {
  }
  try {
    e.srcObject = null;
  } catch {
  }
  e.removeAttribute("src");
  try {
    e.load();
  } catch {
  }
}
function qt(e) {
  if (!e) return;
  e instanceof HTMLVideoElement && At(e);
  const t = (i) => {
    for (const s of Array.from(i.querySelectorAll("*")))
      s instanceof HTMLVideoElement && At(s), s.shadowRoot && t(s.shadowRoot);
  };
  t(e), "shadowRoot" in e && e.shadowRoot && t(e.shadowRoot);
}
const qs = 248, Gs = 249, Ys = 250, xt = 251, It = 252, Bt = 253, Nt = 254, Xs = 255;
function* Ut(e, t, i) {
  const s = new DataView(e.buffer, e.byteOffset, e.byteLength);
  let r = t;
  for (; r + 8 <= i; ) {
    let o = s.getUint32(r), n = 8;
    if (o === 1) {
      if (r + 16 > i) return;
      o = Number(s.getBigUint64(r + 8)), n = 16;
    } else o === 0 && (o = i - r);
    if (o < n || r + o > i) return;
    yield { type: String.fromCharCode(e[r + 4], e[r + 5], e[r + 6], e[r + 7]), start: r + n, end: r + o }, r += o;
  }
}
function Ks(e, t, i = 0) {
  const s = new DataView(e.buffer, e.byteOffset, e.byteLength), r = Ut(e, 0, e.length).next().value;
  if (!r || r.type !== "moof") return [];
  for (const o of Ut(e, r.start, r.end)) {
    if (o.type !== "traf") continue;
    let n = 0, a = i, h = null;
    const u = [];
    for (const d of Ut(e, o.start, o.end)) {
      const l = s.getUint32(d.start) & 16777215;
      if (d.type === "tfhd") {
        let _ = d.start + 8;
        l & 1 && (_ += 8), l & 2 && (_ += 4), l & 8 && (n = s.getUint32(_), _ += 4), l & 16 && (_ += 4), l & 32 && (a = s.getUint32(_));
      } else if (d.type === "tfdt")
        h = e[d.start] === 1 ? Number(s.getBigUint64(d.start + 4)) : s.getUint32(d.start + 4);
      else if (d.type === "trun" && h != null) {
        const _ = s.getUint32(d.start + 4);
        let v = d.start + 8;
        l & 1 && (v += 4);
        let y = null;
        l & 4 && (y = s.getUint32(v), v += 4);
        let z = h;
        for (let O = 0; O < _ && v <= d.end; O++) {
          let N = n, k = O === 0 && y != null ? y : a;
          l & 256 && (N = s.getUint32(v), v += 4), l & 512 && (v += 4), l & 1024 && (k = s.getUint32(v), v += 4), l & 2048 && (v += 4), k & 65536 || u.push(z / t), z += N;
        }
      }
    }
    return u;
  }
  return [];
}
function Zs(e, t) {
  for (let i = 4; i + 16 <= e.length; i++) {
    if (e[i] !== 116 || e[i + 1] !== 102 || e[i + 2] !== 100 || e[i + 3] !== 116) continue;
    const s = e[i + 4], r = new DataView(e.buffer, e.byteOffset + i + 8);
    return (s === 1 ? Number(r.getBigUint64(0)) : r.getUint32(0)) / t;
  }
  return null;
}
function Js(e) {
  for (let t = 4; t + 28 <= e.length; t++)
    if (!(e[t] !== 116 || e[t + 1] !== 114 || e[t + 2] !== 101 || e[t + 3] !== 120))
      return new DataView(e.buffer, e.byteOffset + t + 24).getUint32(0);
  return 0;
}
function Qs(e) {
  for (let t = 4; t + 24 <= e.length; t++) {
    if (e[t] !== 109 || e[t + 1] !== 100 || e[t + 2] !== 104 || e[t + 3] !== 100) continue;
    const i = e[t + 4], s = t + 8 + (i === 1 ? 16 : 8);
    return s + 4 > e.length ? null : new DataView(e.buffer, e.byteOffset + s).getUint32(0);
  }
  return null;
}
function Ce(e) {
  let t = 0;
  for (const r of e) t += r.length;
  const i = new Uint8Array(t);
  let s = 0;
  for (const r of e)
    i.set(r, s), s += r.length;
  return i;
}
function tr(e) {
  return e.split(",").map((t) => t.trim()).filter(Boolean).join(", ");
}
class er {
  constructor() {
    this._carry = null, this._codecs = "", this._timescale = 9e4, this._trexFlags = 0, this._parts = null;
  }
  reset() {
    this._carry = null, this._parts = null;
  }
  push(t) {
    let i = t;
    if (this._carry) {
      const o = new Uint8Array(this._carry.length + t.length);
      o.set(this._carry), o.set(t, this._carry.length), i = o, this._carry = null;
    }
    const s = [];
    let r = 0;
    for (; i.length - r >= 4; ) {
      const o = i[r], n = i[r + 1] << 16 | i[r + 2] << 8 | i[r + 3];
      if (i.length - r - 4 < n) break;
      const a = i.subarray(r + 4, r + 4 + n);
      r += 4 + n, this._frame(o, a, s);
    }
    return r < i.length && (this._carry = i.slice(r)), s;
  }
  _frame(t, i, s) {
    switch (t) {
      case qs:
        this._codecs = tr(new TextDecoder().decode(i));
        return;
      case Ys: {
        const r = i.slice();
        this._timescale = Qs(r) ?? this._timescale, this._trexFlags = Js(r), s.push({ kind: "init", codecs: this._codecs, data: r });
        return;
      }
      case Gs:
        this._parts = { [xt]: [], [Nt]: [], [It]: [], [Bt]: [] };
        return;
      case xt:
      case Nt:
      case It:
      case Bt:
        this._parts?.[t].push(i.slice());
        return;
      case Xs: {
        const r = this._parts;
        if (this._parts = null, !r || !r[xt].length) return;
        const o = Ce(r[xt]);
        s.push({
          kind: "media",
          data: Ce([o, ...r[Nt], ...r[It], ...r[Bt]]),
          time: Zs(o, this._timescale),
          keys: Ks(o, this._timescale, this._trexFlags)
        });
        return;
      }
      default:
        return;
    }
  }
}
const ir = "/api/protect_stream/ws", sr = 45 * 86400, rr = 30, Fe = 12, or = 45, nr = 90, ze = 1, ar = 4, hr = 10 * 6e4, lr = 1500, cr = 9e4, Gt = 2e4, Re = [1e3, 3e3, 8e3], dr = 15e3, pr = 4 * 1024 * 1024, ur = 0.75, Le = 3, _r = 1200, Vt = 0.2, De = oi ? 450 : 250;
class fr {
  constructor(t, i = {}) {
    this._hass = t, this._hooks = i, this.base = Math.floor(Date.now() / 1e3) - sr, this._video = null, this._nvrId = "", this._cameraId = "", this._channel = 0, this._ms = null, this._msUrl = null, this._msOpen = !1, this._mmsStreaming = !0, this._sb = null, this._codecs = "", this._ops = [], this._busy = !1, this._lastEvict = 0, this._quotaHold = !1, this._ws = null, this._wsOpening = null, this._gen = 0, this._stream = null, this._deframer = new er(), this._retryPending = !1, this._fails = 0, this._progressMark = -1 / 0, this._idleUntil = 0, this._skipFrom = null, this._live = !1, this._liveFirst = null, this._liveJoined = !1, this._wantPlay = !1, this._bound = null, this._boundHit = !1, this._rate = 1, this._epoch = 0, this._settled = !1, this._target = null, this._awaitSeeked = !1, this._seekedAt = 0, this._twoStep = null, this._recoveries = 0, this._keys = [], this._rvfc = 0, this._destroyed = !1, this._onSbUpdateEnd = () => {
      this._busy = !1, this._extendDuration(), this._tick(), this._pump();
    }, this._onSbError = () => {
      this._busy = !1;
      const s = this._stream;
      s && this._streamFailed(s, "the browser rejected the footage (SourceBuffer error)");
    }, this._onMessage = (s) => {
      const r = this._stream;
      if (typeof s.data == "string") {
        let n;
        try {
          n = JSON.parse(s.data);
        } catch {
          return;
        }
        if (!r || n.gen !== r.gen) return;
        n.ev === "open" ? r.opened = !0 : n.ev === "end" ? (r.ended = !0, this._onStreamEnd(r)) : n.ev === "error" && this._streamFailed(r, n.message || "stream error");
        return;
      }
      const o = s.data;
      if (!(!r || o.byteLength < 4 || new DataView(o).getUint32(0) !== r.gen))
        for (const n of this._deframer.push(new Uint8Array(o, 4))) this._accept(r, n);
    }, this._tick = () => {
      const s = this._video;
      if (!s || !this._sb || this._destroyed || this._failedMsg) return;
      if (this._live) {
        this._liveTick(s), this._queueEvict(), this._pump();
        return;
      }
      !this._settled && this._target != null && this._twoStep == null && s.readyState >= 1 && !s.seeking && (s.currentTime < this._target - 0.25 || s.currentTime > this._target + Le) ? (this._awaitSeeked = !0, s.currentTime = this._target) : !this._settled && this._target != null && this._twoStep == null && !this._awaitSeeked && !s.seeking && this._recoveries < 2 && performance.now() - this._seekedAt > _r && this._recoverSeek(s);
      const r = this._settled ? s.currentTime : this._target ?? s.currentTime, o = this._rangeAt(r), n = this._stream, a = o ? o[1] - r : 0;
      if (!s.seeking) {
        const h = this._nextRangeAfter(o ? o[1] : r), u = o ? o[1] - r < 0.3 : !0, d = n && !n.ended && (n.last == null || (o ? n.last <= o[1] + 0.5 : n.last < r));
        if (u && h != null && !d && (this._settled || n?.first != null && n.first > r)) {
          this._settled || (this._target = h), this._awaitSeeked = !0, s.currentTime = h;
          return;
        }
      }
      if (n?.kind === "play" && !n.ended) {
        const h = !this._mmsStreaming && a > 2;
        !n.paused && (a > rr || h) ? this._flow(!0) : n.paused && a < Fe && !h && this._flow(!1);
      } else if (!n && a < Fe && this._mmsStreaming && !this._retryPending) {
        let h = o ? o[1] : r;
        this._skipFrom != null && this._skipFrom > h && (h = this._skipFrom);
        const u = this._bound != null ? this._bound / 1e3 - this.base : 1 / 0, d = (h + this.base) * 1e3;
        h < u - 0.3 && d < Date.now() - lr && performance.now() >= this._idleUntil && this._openPlay(d);
      }
      this._queueEvict(), this._pump();
    }, this._onSeeked = () => {
      const s = this._video;
      if (s && this._twoStep != null) {
        const r = this._twoStep;
        this._twoStep = null, this._awaitSeeked = !0, s.currentTime = r;
        return;
      }
      this._awaitSeeked = !1, this._seekedAt = performance.now(), s && !this._hasRvfc() && this._presented(s.currentTime), this._tick();
    }, this._onTimeUpdate = () => {
      const s = this._video;
      s && !this._hasRvfc() && !s.seeking && this._presented(s.currentTime);
    }, this._onMediaEvent = () => {
      this._tick(), this._hooks.change?.();
    }, this._onVideoError = () => {
      const s = this._video;
      if (!s?.error || !this._ms) return;
      const r = this._stream, o = `video error ${s.error.code}${s.error.message ? `: ${s.error.message}` : ""}`, n = this.wallTime, a = this._live;
      this._dropMedia(), r ? this._streamFailed(r, o) : this._hooks.problem?.(o), !this._failedMsg && (a ? this.live() : n != null && this.seek(n));
    };
  }
  // ---- public surface ------------------------------------------------------
  get video() {
    return this._video;
  }
  /** True while following the live edge. */
  get isLive() {
    return this._live;
  }
  /** The current seek / live switch has presented its frame. */
  get settled() {
    return this._settled;
  }
  /** Waiting for footage (a seek or switch not presented yet, or a stall). */
  get loading() {
    const t = this._video;
    return !t || this._failedMsg ? !1 : this._settled ? this._wantPlay && !t.paused && t.readyState < 3 : !0;
  }
  get failedMessage() {
    return this._failedMsg;
  }
  /** Recorded playback is paused at the bound set with setBound(). */
  get atBound() {
    return this._boundHit;
  }
  /**
   * Wall-clock ms of the frame on screen. While a seek is pending this is the
   * seek TARGET, so a second skip pressed before the first lands adds up.
   */
  get wallTime() {
    return !this._settled && this._target != null ? (this._target + this.base) * 1e3 : this._lastWall;
  }
  /** Bind (or re-bind) the <video>. A re-bind rebuilds at the same position. */
  attach(t) {
    if (this._video === t) return;
    const i = this._video, s = i ? { live: this._live, wall: this.wallTime, play: this._wantPlay } : null;
    i && this._unbindVideo(i), this._dropMedia(), this._video = t, this._bindVideo(t), s?.live ? this.live() : s?.wall != null && this.seek(s.wall, { play: s.play });
  }
  /** Camera (and channel). A change drops everything loaded. */
  setSource(t, i, s = 0) {
    return t === this._nvrId && i === this._cameraId && s === this._channel ? !1 : (this._nvrId = t, this._cameraId = i, this._channel = s, this._stopStream(), this._dropMedia(), this._lastWall = void 0, this._epoch++, this._settled = !1, this._target = null, !0);
  }
  /** Recorded playback stops (paused) here; nothing is fetched past it. */
  setBound(t) {
    this._bound = t && t > 0 ? t : null, this._boundHit = !1;
  }
  setRate(t) {
    this._rate = t, this._video && (this._video.playbackRate = t);
  }
  /** Follow the live edge. */
  live() {
    !this._video || this._destroyed || (this._failedMsg = void 0, this._live = !0, this._liveFirst = null, this._liveJoined = !1, this._bound = null, this._boundHit = !1, this._wantPlay = !0, this._skipFrom = null, this._newEpoch(null), this._ensureMedia(), this._openStream("live", Date.now()), this._hooks.change?.());
  }
  /**
   * Show the frame at `wallMs` exactly. Inside what is loaded this is a native
   * seek; outside it the NVR streams from the keyframe before `wallMs` into
   * the same buffer, and the frame on screen stays until the target presents.
   */
  seek(t, i = {}) {
    const s = this._video;
    if (!s || this._destroyed) return;
    this._failedMsg = void 0, i.play !== void 0 && (this._wantPlay = i.play), this._live && this._stream?.kind === "live" && this._stopStream(), this._live = !1, this._liveJoined = !1, this._boundHit = !1, this._skipFrom = null, this._idleUntil = 0;
    let r = t / 1e3 - this.base;
    this._bound != null && (r = Math.min(r, (this._bound - De) / 1e3 - this.base)), this._newEpoch(r), this._ensureMedia();
    const o = this._rangeAt(r), n = !!o && o[1] - r >= Vt, a = this._stream;
    a && a.kind === "play" && !this._feeds(a, n ? o : null, r) && this._stopStream(), this._awaitSeeked = !0, s.currentTime = r, !n && !this._stream && this._openPlay((r + this.base) * 1e3), this._wantPlay ? this._play() : s.pause(), this._tick(), this._hooks.change?.();
  }
  play() {
    this._wantPlay = !0, !this._boundHit && (this._play(), this._tick());
  }
  /** Pause. Pausing LIVE leaves live: the paused frame becomes recorded footage. */
  pause() {
    this._wantPlay = !1, this._video?.pause(), this._live && (this._live = !1, this._liveJoined = !1, this._stream?.kind === "live" && this._stopStream(), this._video && (this._target = this._video.currentTime)), this._hooks.change?.();
  }
  /** Is this wall-clock instant loaded (so a seek to it is native)? */
  isLoaded(t) {
    const i = t / 1e3 - this.base, s = this._rangeAt(i);
    return !!s && s[1] - i >= Vt;
  }
  /** Release the decoder and the socket (hidden card). The next live()/seek() rebuilds. */
  suspend() {
    this._stopStream(), this._closeSocket(), this._dropMedia(), this._settled = !1;
  }
  destroy() {
    this._destroyed = !0, this.suspend(), this._video && this._unbindVideo(this._video), this._video = null, clearInterval(this._tickTimer);
  }
  // ---- media source --------------------------------------------------------
  _ensureMedia() {
    const t = this._video;
    if (!t || this._ms) return;
    const s = window.ManagedMediaSource, r = new (s ?? MediaSource)();
    this._ms = r, this._msOpen = !1, this._mmsStreaming = !0, t.disableRemotePlayback = !0, r.addEventListener(
      "sourceopen",
      () => {
        this._ms === r && (this._msOpen = !0, this._pump());
      },
      { once: !0 }
    ), s ? (r.addEventListener("startstreaming", () => {
      this._mmsStreaming = !0, this._tick();
    }), r.addEventListener("endstreaming", () => {
      this._mmsStreaming = !1, this._tick();
    }), t.srcObject = r) : (this._msUrl = URL.createObjectURL(r), t.src = this._msUrl), t.playbackRate = this._rate;
  }
  /** Detach the MediaSource and free the decoder (a detached element keeps it). */
  _dropMedia() {
    this._ops = [], this._busy = !1, this._sb = null, this._codecs = "", this._msOpen = !1, this._quotaHold = !1, this._ms && (this._ms = null, this._video && At(this._video), this._msUrl && URL.revokeObjectURL(this._msUrl), this._msUrl = null), this._liveFirst = null, this._liveJoined = !1;
  }
  /** Run the next queued append/remove. */
  _pump() {
    if (!(!this._ms || !this._msOpen || this._busy || this._quotaHold))
      for (; this._ops.length; ) {
        const i = this._ops[0];
        if (i.t !== "remove" && i.gen !== this._gen) {
          this._ops.shift();
          continue;
        }
        if (i.t === "init" && !this._prepareBuffer(i.codecs)) {
          this._ops.shift();
          return;
        }
        const s = this._sb;
        if (!s) {
          this._ops.shift();
          continue;
        }
        if (s.updating) return;
        try {
          if (i.t === "remove") {
            if (this._ops.shift(), i.end > i.start) {
              this._busy = !0, s.remove(i.start, i.end);
              return;
            }
            continue;
          }
          let r = i.data, o = 1;
          if (i.t === "media") {
            const n = [i.data];
            let a = i.data.length;
            for (; o < this._ops.length; ) {
              const h = this._ops[o];
              if (h.t !== "media" || h.gen !== i.gen || a + h.data.length > pr) break;
              n.push(h.data), a += h.data.length, o++;
            }
            if (o > 1) {
              r = new Uint8Array(a);
              let h = 0;
              for (const u of n)
                r.set(u, h), h += u.length;
            }
          }
          this._busy = !0, s.appendBuffer(r), this._ops.splice(0, o);
          return;
        } catch (r) {
          if (this._busy = !1, r?.name === "QuotaExceededError") {
            this._onQuota();
            return;
          }
          this._ops.shift();
          const o = this._stream;
          o && this._streamFailed(o, `append failed: ${r?.message ?? r}`);
          return;
        }
      }
  }
  /** Create the SourceBuffer on the first init, or switch codecs. */
  _prepareBuffer(t) {
    const i = this._ms;
    if (!i) return !1;
    const s = `video/mp4; codecs="${t}"`;
    if (this._sb) {
      if (t === this._codecs) return !0;
      const o = this._sb;
      if (o.changeType && !o.updating)
        try {
          return o.changeType(s), this._codecs = t, !0;
        } catch {
        }
      const n = this._stream;
      return n && this._streamFailed(n, `codec changed to ${t}`), !1;
    }
    const r = i.constructor;
    if (r.isTypeSupported && !r.isTypeSupported(s))
      return this._giveUp(`This device cannot play this camera's video (${t}).`), !1;
    try {
      const o = i.addSourceBuffer(s);
      return o.mode = "segments", o.timestampOffset = -this.base, o.addEventListener("updateend", this._onSbUpdateEnd), o.addEventListener("error", this._onSbError), this._sb = o, this._codecs = t, this._extendDuration(), !0;
    } catch (o) {
      return this._giveUp(`Could not start the player: ${o?.message ?? o}`), !1;
    }
  }
  /**
   * Keep the MediaSource's duration a day past now. It otherwise only grows
   * with what has been appended, and a seek past it is CLAMPED to the
   * buffered end, where the element then waits forever (reproduced: a seek
   * two minutes ahead of everything loaded sat `seeking` at the old end
   * while the new footage arrived). Only valid while nothing is updating.
   */
  _extendDuration() {
    const t = this._ms, i = this._sb;
    if (!t || !i || t.readyState !== "open" || i.updating) return;
    const s = Date.now() / 1e3 - this.base + 86400;
    if (!Number.isNaN(t.duration) && t.duration >= s - 3600) return;
    try {
      t.duration = s;
    } catch {
      return;
    }
    const r = this._video;
    r && !this._settled && this._target != null && Math.abs(r.currentTime - this._target) > 0.25 && (this._awaitSeeked = !0, r.currentTime = this._target);
  }
  /** The buffer is full: drop what is behind the playhead and try again. */
  _onQuota() {
    this._quotaHold = !0, this._flow(!0);
    const t = this._queueEvict(!0);
    window.setTimeout(() => {
      this._quotaHold = !1, this._pump();
    }, t ? 0 : 1e3);
  }
  /**
   * Queue removals: footage more than BACK_KEEP_S behind the playhead, and
   * islands far ahead of it. Never the range a pending seek is heading for.
   */
  _queueEvict(t = !1) {
    const i = this._sb, s = this._video;
    if (!i || !s) return !1;
    const r = performance.now();
    if (!t && r - this._lastEvict < 2e3) return !1;
    this._lastEvict = r;
    const o = s.currentTime, n = t ? 4 : or, a = this._settled ? null : this._target, h = [];
    for (let u = 0; u < i.buffered.length; u++) {
      const d = i.buffered.start(u), l = i.buffered.end(u);
      a != null && d <= a && a <= l || (l < o - n ? h.push([d, l]) : d < o - n ? h.push([d, o - n]) : d > o + nr && h.push([d, l]));
    }
    return h.length ? (this._ops.unshift(...h.map(([u, d]) => ({ t: "remove", start: u, end: d }))), !0) : !1;
  }
  // ---- streams -------------------------------------------------------------
  _openPlay(t) {
    let i = t + hr;
    this._bound != null && (i = Math.min(i, this._bound)), this._bound == null && i > Date.now() - 1e3 && (i = void 0), this._openStream("play", t, i);
  }
  _openStream(t, i, s) {
    this._stopStream();
    const r = ++this._gen;
    this._deframer.reset();
    const o = { gen: r, kind: t, from: i, end: s, opened: !1, paused: !1, ended: !1, first: null, last: null };
    this._stream = o, clearTimeout(this._firstDataTimer), this._firstDataTimer = window.setTimeout(() => {
      this._stream === o && o.last == null && !o.ended && this._streamFailed(o, "the NVR sent no footage");
    }, dr), this._socket().then(
      (n) => {
        if (this._stream !== o) return;
        const a = {
          op: t,
          gen: r,
          nvr_id: this._nvrId,
          camera_id: this._cameraId,
          channel: this._channel
        };
        t === "play" && (a.start = Math.round(i), s && (a.end = Math.round(s))), n.send(JSON.stringify(a));
      },
      (n) => {
        this._stream === o && this._streamFailed(o, `relay unreachable: ${n?.message ?? n}`);
      }
    );
  }
  /** Drop the stream in flight; anything it still sends is ignored. */
  _stopStream() {
    const t = this._stream;
    t && (this._stream = null, this._gen++, clearTimeout(this._firstDataTimer), clearTimeout(this._retryTimer), this._retryPending = !1, !t.ended && this._ws?.readyState === WebSocket.OPEN && this._ws.send(JSON.stringify({ op: "stop" })));
  }
  /** Pause / resume the NVR (recorded only; live cannot be throttled). */
  _flow(t) {
    const i = this._stream;
    !i || i.kind !== "play" || i.ended || i.paused === t || (i.paused = t, this._ws?.readyState === WebSocket.OPEN && this._ws.send(JSON.stringify({ op: t ? "pause" : "resume" })));
  }
  _socket() {
    if (this._ws?.readyState === WebSocket.OPEN) return Promise.resolve(this._ws);
    if (this._wsOpening) return this._wsOpening;
    const t = (async () => {
      const i = this._hass();
      if (!i) throw new Error("Home Assistant not connected");
      const s = await Ke(i, ir, 30), r = i.auth?.data?.hassUrl || window.location.origin, o = new URL(s, r);
      o.protocol = o.protocol === "https:" ? "wss:" : "ws:";
      const n = new WebSocket(o.toString());
      return n.binaryType = "arraybuffer", await new Promise((a, h) => {
        const u = window.setTimeout(() => h(new Error("timed out")), 1e4);
        n.onopen = () => {
          clearTimeout(u), a();
        }, n.onclose = () => {
          clearTimeout(u), h(new Error("closed (is protect_cache installed and up to date?)"));
        };
      }), n.onmessage = this._onMessage, n.onclose = () => {
        if (this._ws !== n) return;
        this._ws = null;
        const a = this._stream;
        a && !a.ended && this._streamFailed(a, "connection to Home Assistant lost");
      }, this._ws = n, n;
    })();
    return this._wsOpening = t, t.then(
      () => {
        this._wsOpening === t && (this._wsOpening = null);
      },
      () => {
        this._wsOpening === t && (this._wsOpening = null);
      }
    ), t;
  }
  _closeSocket() {
    const t = this._ws;
    if (this._ws = null, this._wsOpening = null, t) {
      t.onclose = null, t.onmessage = null;
      try {
        t.close();
      } catch {
      }
    }
  }
  _accept(t, i) {
    if (i.kind === "init")
      this._ops.push({ t: "init", gen: t.gen, data: i.data, codecs: i.codecs });
    else {
      if (i.time != null) {
        const s = i.time - this.base;
        t.first == null && (t.first = s, t.kind === "live" && (this._liveFirst = s), clearTimeout(this._firstDataTimer)), t.last = s;
      }
      for (const s of i.keys) this._addKey(s - this.base);
      this._ops.push({ t: "media", gen: t.gen, data: i.data });
    }
    this._pump();
  }
  _onStreamEnd(t) {
    if (this._stream === t) {
      if (clearTimeout(this._firstDataTimer), t.kind === "live") {
        this._streamFailed(t, "the NVR ended the live stream");
        return;
      }
      t.last == null ? t.end && t.end < Date.now() - 6e4 ? this._skipFrom = t.end / 1e3 - this.base : this._idleUntil = performance.now() + 2e3 : t.end || (this._idleUntil = performance.now() + 3e3), this._stream = null, this._tick();
    }
  }
  _streamFailed(t, i) {
    if (this._stream !== t) return;
    if (t.kind === "play" && /refused/.test(i) && t.from > Date.now() - cr) {
      this._notRecordedYet(t);
      return;
    }
    this._hooks.problem?.(i), this._stopStream();
    const s = this._video;
    if (s && (this._progressMark = Math.max(this._progressMark, s.currentTime)), this._fails++, this._fails > Re.length) {
      this._giveUp("This footage could not be played. Tap an event or the timeline to try again.");
      return;
    }
    const r = Re[this._fails - 1];
    clearTimeout(this._retryTimer), this._retryPending = !0, this._retryTimer = window.setTimeout(() => {
      this._retryPending = !1, !(this._destroyed || this._stream) && (this._live ? this._openStream("live", Date.now()) : this._tick());
    }, r), this._hooks.change?.();
  }
  /**
   * The NVR refuses a playback that starts after its recording edge - footage
   * reaches its disk ~13-20 s after it happens (measured: a request ending
   * "10 s ago" was granted up to 19.4 s ago), and live has no history. Not a
   * failure: a pending seek lands on the nearest footage there is (the start
   * of the live buffer after a rewind from live), and playback that caught up
   * with the edge waits for it to move on.
   */
  _notRecordedYet(t) {
    this._stopStream(), this._idleUntil = performance.now() + 2e3;
    const i = this._video;
    if (i && !this._settled && this._target != null) {
      const s = this._nextRangeAfter(this._target);
      s != null && (this._target = s, this._awaitSeeked = !0, i.currentTime = s);
    }
    this._hooks.change?.();
  }
  _giveUp(t) {
    this._stopStream(), this._failedMsg = t, this._hooks.failed?.(t), this._hooks.change?.();
  }
  // ---- playback control loop -----------------------------------------------
  /** Range [start, end] (media s) containing t, or null. */
  _rangeAt(t) {
    const i = this._sb;
    if (!i) return null;
    const s = i.buffered;
    for (let r = 0; r < s.length; r++)
      if (s.start(r) - 0.05 <= t && t <= s.end(r)) return [s.start(r), s.end(r)];
    return null;
  }
  /** Does this recorded stream feed the footage around t? */
  _feeds(t, i, s) {
    const r = t.last ?? t.from / 1e3 - this.base, o = (i ? i[0] : s) - 1, n = (i ? i[1] : s) + 1;
    return r >= o && r <= n;
  }
  _nextRangeAfter(t) {
    const i = this._sb;
    if (!i) return null;
    const s = i.buffered;
    for (let r = 0; r < s.length; r++) if (s.start(r) > t + 0.05) return s.start(r);
    return null;
  }
  _liveTick(t) {
    const i = this._sb;
    if (!i || this._liveFirst == null) return;
    const s = i.buffered.length;
    if (!s) return;
    const r = i.buffered.end(s - 1);
    if (!(r < this._liveFirst)) {
      if (!this._liveJoined) {
        if (r - this._liveFirst < 0.3) return;
        this._liveJoined = !0, this._awaitSeeked = !0;
        const o = this._keyBefore(r - ze, this._liveFirst);
        t.currentTime = o ?? this._liveFirst, this._wantPlay && this._play();
        return;
      }
      !t.paused && !t.seeking && r - t.currentTime > ar && (t.currentTime = r - ze);
    }
  }
  _newEpoch(t) {
    this._epoch++, this._settled = !1, this._target = t, this._twoStep = null, this._recoveries = 0;
  }
  _addKey(t) {
    const i = this._keys;
    let s = i.length;
    for (; s > 0 && i[s - 1] > t; ) s--;
    s > 0 && Math.abs(i[s - 1] - t) < 5e-3 || s < i.length && Math.abs(i[s] - t) < 5e-3 || (i.splice(s, 0, t), i.length > 400 && i.splice(0, i.length - 400));
  }
  /** The last keyframe at or before t, not before `from` (null if unknown). */
  _keyBefore(t, i) {
    for (let s = this._keys.length - 1; s >= 0; s--) {
      const r = this._keys[s];
      if (r <= t + 1e-3) return r >= i - 0.05 ? r : null;
    }
    return null;
  }
  /**
   * A seek that has to decode from a keyframe seconds back can stall in
   * MSE: `seeked` fires, the clock runs, and no new frame is ever drawn
   * (reproduced with Chrome's software decoder on these 2K and 720p streams,
   * plain MSE, no engine involved). Landing on the keyframe first and then
   * seeking FORWARD to the target plays at once. Used only as a recovery,
   * so a device that seeks directly never flashes the keyframe's picture.
   */
  _recoverSeek(t) {
    const i = this._target;
    if (i == null) return;
    const s = this._rangeAt(i);
    if (!s || s[1] - i < Vt) return;
    this._recoveries++;
    const r = this._keyBefore(i, s[0]);
    this._awaitSeeked = !0, r != null && i - r > 0.05 ? (this._twoStep = i, t.currentTime = r) : t.currentTime = i;
  }
  _play() {
    const t = this._video;
    t && (this._hooks.play ? this._hooks.play(t) : t.play().catch(() => {
    }));
  }
  // ---- the <video> ---------------------------------------------------------
  _bindVideo(t) {
    t.addEventListener("seeked", this._onSeeked), t.addEventListener("timeupdate", this._onTimeUpdate), t.addEventListener("waiting", this._onMediaEvent), t.addEventListener("playing", this._onMediaEvent), t.addEventListener("pause", this._onMediaEvent), t.addEventListener("error", this._onVideoError), this._armFrameCallback(t), clearInterval(this._tickTimer), this._tickTimer = window.setInterval(this._tick, 250);
  }
  _unbindVideo(t) {
    t.removeEventListener("seeked", this._onSeeked), t.removeEventListener("timeupdate", this._onTimeUpdate), t.removeEventListener("waiting", this._onMediaEvent), t.removeEventListener("playing", this._onMediaEvent), t.removeEventListener("pause", this._onMediaEvent), t.removeEventListener("error", this._onVideoError);
    const i = t;
    this._rvfc && i.cancelVideoFrameCallback && i.cancelVideoFrameCallback(this._rvfc), this._rvfc = 0;
  }
  _armFrameCallback(t) {
    const i = t;
    if (!i.requestVideoFrameCallback) return;
    const s = (r, o) => {
      this._video === t && (this._presented(o.mediaTime), this._rvfc = i.requestVideoFrameCallback(s));
    };
    this._rvfc = i.requestVideoFrameCallback(s);
  }
  _hasRvfc() {
    return !!this._video && "requestVideoFrameCallback" in this._video;
  }
  _presented(t) {
    const i = this._video;
    if (!i) return;
    if (!this._settled) {
      if (this._awaitSeeked || !(this._live ? this._liveFirst != null && t >= this._liveFirst - 0.05 : this._target != null && t >= this._target - ur && t <= this._target + Le)) return;
      this._settled = !0, this._hooks.change?.();
    }
    const s = (t + this.base) * 1e3;
    if (this._lastWall = s, t > this._progressMark + 1 && (this._fails = 0, this._progressMark = t), !this._live && this._bound != null && !this._boundHit && !i.paused && s >= this._bound - De * Math.max(1, i.playbackRate)) {
      this._boundHit = !0, this._wantPlay = !1, i.pause(), this._hooks.frame?.(s), this._hooks.boundReached?.(), this._hooks.change?.();
      return;
    }
    this._hooks.frame?.(s);
  }
}
var mr = Object.defineProperty, vr = Object.getOwnPropertyDescriptor, g = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? vr(t, i) : t, o = e.length - 1, n; o >= 0; o--)
    (n = e[o]) && (r = (s ? n(t, i, r) : n(r)) || r);
  return s && r && mr(t, i, r), r;
};
const Oe = 5 * 6e4, gr = 400, br = 1200, Ht = 400, wr = 40, yr = 5, xr = 15, kr = 5e3, Sr = 15e3, $r = 350, Tr = 3e3, Ie = Gt + 5e3, Er = 250;
function Be(e) {
  return e?.name === "NotAllowedError";
}
let f = class extends j {
  constructor() {
    super(...arguments), this.nvrId = "", this.cameraId = "", this.gaps = [], this.targetTime = Date.now(), this.scrubbing = !1, this.live = !1, this.now = Date.now(), this.previewDir = "", this.previewMode = "sprites", this.fastPreview = "speed", this.tipEnabled = !1, this.clipEndTime = 0, this.accent = "", this.liveAudioStart = "muted", this.stacked = !1, this.startFs = !1, this.fsHandoff = !1, this.fsTimeline = !1, this.fsTimelineWidth = 165, this.fsTimelineGrabWidth = 0, this.fsTimelinePadding = 100, this.fsTimelineGutter = 140, this.fsTimelineScrim = 0.88, this.fsTimelineScrimExtend = 170, this._player = new fr(() => this.hass, {
      frame: (e) => this._onFrame(e),
      change: () => this._onPlayerChange(),
      boundReached: () => this._finishEvent(),
      failed: (e) => {
        this._error = e;
      },
      problem: (e) => this._reportPlaybackProblem(e),
      play: (e) => this._playFollowVideo(e)
    }), this._mode = null, this._waiting = !1, this._blank = !1, this._liveSettled = !1, this._liveEpoch = 0, this._followPaused = !1, this._followMuted = !0, this._tapToPlay = !1, this._followCtrl = !1, this._ctrlMode = "live", this._isFs = !1, this._forceRotate = !1, this._modalOn = !1, this._followRate = 1, this._nearLive = !1, this._livePausedState = !1, this._liveMuted = !0, this._livePreviewWarmed = !1, this._liveAudioAttempted = !1, this._liveAudioTrying = !1, this._eventEndSent = !1, this._stageRestarts = [], this._lastTimeReport = 0, this._preview = new js(), this._previewActive = null, this._previewBlocks = {
      a: void 0,
      b: void 0
    }, this._previewPending = {
      a: void 0,
      b: void 0
    }, this._previewRetries = { a: 0, b: 0 }, this._previewToken = 0, this._coarseScrub = !1, this._scrubDir = 1, this._spriteReady = !1, this._spriteToken = 0, this._autoSprites = !1, this._seekSamples = [], this._reattached = !1, this._resumePaused = !1, this._resumeOnShow = !1, this._stageStuckSince = 0, this._stageLastCt = -1, this._hidden = !1, this._suspended = !1, this._hostIntersecting = !0, this._onDocVisibility = () => {
      this._onHostVisibility(this._hostIntersecting && !document.hidden);
    }, this._onTapToPlay = (e) => {
      e.stopPropagation(), this._tapToPlay = !1, this._mode === "live" ? (this._livePausedState = !1, this._reportLivePlaying(!0)) : this._followPaused = !1;
      const t = this._mainVideo;
      t && this._playFollowVideo(t);
    }, this._frozen = !1, this._showFollowCtrl = () => {
      this._followCtrl = !0, clearTimeout(this._followCtrlTimer), !(this.scrubbing || this._seekDragAt !== void 0) && (this._followCtrlTimer = setTimeout(() => {
        this._followCtrl = !1;
      }, 5200));
    }, this._hideFollowCtrl = () => {
      clearTimeout(this._followCtrlTimer), this._followCtrl = !1, this._ctrlDismissedAt = Date.now();
    }, this._ctrlDismissedAt = 0, this._keepCtrlAlive = () => {
      this._followCtrl && this._showFollowCtrl();
    }, this._onPressCapture = (e) => {
      this._tap = e.isPrimary ? {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
        visible: this._followCtrl,
        control: this._isControlTarget(e)
      } : void 0;
    }, this._onReleaseCapture = (e) => {
      const t = this._tap;
      this._tap = void 0, !(!t || t.id !== e.pointerId || t.control || this.scrubbing || Math.hypot(e.clientX - t.x, e.clientY - t.y) > f.TAP_SLOP_PX || performance.now() - t.t > f.TAP_MAX_MS) && (clearTimeout(this._pendingTap?.timer), this._pendingTap = {
        visible: t.visible,
        timer: setTimeout(() => this._commitTap(), f.TAP_CLICK_WAIT_MS)
      });
    }, this._onCancelCapture = () => {
      this._tap = void 0;
    }, this._onClickCapture = (e) => {
      const t = this._pendingTap;
      if (t) {
        if (this._isControlTarget(e)) {
          clearTimeout(t.timer), this._pendingTap = void 0;
          return;
        }
        this._commitTap();
      }
    }, this._onStageHover = (e) => {
      e.pointerType === "mouse" && this._showFollowCtrl();
    }, this._toggleFollowPlay = (e) => {
      if (e.stopPropagation(), this._followPaused && (this._eventEndSent || this._player.atBound)) {
        this._seekFollowTo(this.targetTime), this._showFollowCtrl();
        return;
      }
      this._followPaused = !this._followPaused, this._followPaused ? this._player.pause() : this._player.play(), this._showFollowCtrl();
    }, this._toggleFollowMute = (e) => {
      e.stopPropagation(), this._setSessionMuted(!this._followMuted), this._showFollowCtrl();
    }, this._toggleFs = (e) => {
      if (e.stopPropagation(), this.fsHandoff && !this._isFs && !document.fullscreenElement) {
        const t = (this._mode === "recorded" ? this._player.wallTime : void 0) ?? this.targetTime;
        this._player.pause(), this.dispatchEvent(
          new CustomEvent("fullscreen-handoff", {
            detail: { camera: this.cameraId, time: t },
            bubbles: !0,
            composed: !0
          })
        );
        return;
      }
      if (this.stacked) {
        const t = !this._isFs;
        this._isFs = t, this._forceRotate = t && window.innerHeight > window.innerWidth, this._showFollowCtrl();
        return;
      }
      document.fullscreenElement ? document.exitFullscreen?.().catch(() => {
      }) : this.requestFullscreen?.().catch(() => {
      }), this._showFollowCtrl();
    }, this._onDlgClose = () => {
      this._modalOn = !1, this._isFs && (this._isFs = !1, this._forceRotate = !1);
    }, this._onFsChange = () => {
      this.stacked || (this._isFs = !!document.fullscreenElement);
    }, this._liveSkipBack = (e) => {
      e.stopPropagation();
      const t = this._player.wallTime ?? Date.now();
      this.dispatchEvent(
        new CustomEvent("rewind", {
          detail: { time: t - 15e3 },
          bubbles: !0,
          composed: !0
        })
      ), this._showFollowCtrl();
    }, this._toggleLivePlay = (e) => {
      e.stopPropagation(), this._livePausedState ? this._startLive() : (this._player.pause(), this._reportLivePlaying(!1)), this._showFollowCtrl();
    }, this._toggleLiveMute = (e) => {
      e.stopPropagation(), this._setSessionMuted(!this._liveMuted), this._showFollowCtrl();
    }, this._skipBack = (e) => {
      e.stopPropagation(), this._followSkip(-15e3);
    }, this._skipFwd = (e) => {
      if (e.stopPropagation(), this._followNearLive()) {
        this.dispatchEvent(new CustomEvent("go-live", { bubbles: !0, composed: !0 }));
        return;
      }
      this._followSkip(15e3);
    }, this._toggleFollowRate = (e) => {
      e.stopPropagation(), !this._followNearLive() && (this._setFollowRate(this._followRate === 1 ? 2 : this._followRate === 2 ? 4 : 1), this._showFollowCtrl());
    }, this._onEventSeekDown = (e) => {
      e.stopPropagation();
      const t = e.currentTarget;
      try {
        t.setPointerCapture(e.pointerId);
      } catch {
      }
      this._seekDragAt = this._eventSeekAt(e, t);
      const i = (n) => {
        this._seekDragAt = this._eventSeekAt(n, t);
      }, s = (n) => {
        t.removeEventListener("pointermove", i), t.removeEventListener("pointerup", r), t.removeEventListener("pointercancel", o);
        const a = this._seekDragAt;
        this._seekDragAt = void 0, n && a !== void 0 && this._seekFollowTo(a), this._showFollowCtrl();
      }, r = () => s(!0), o = () => s(!1);
      t.addEventListener("pointermove", i), t.addEventListener("pointerup", r), t.addEventListener("pointercancel", o), this._showFollowCtrl();
    }, this._onStripPress = (e) => {
      if (e.stopPropagation(), this._keepCtrlAlive(), e.composedPath()[0] !== e.currentTarget) return;
      this.querySelector('[slot="fs-timeline"]')?.beginDrag?.(e);
    };
  }
  connectedCallback() {
    super.connectedCallback(), document.addEventListener("fullscreenchange", this._onFsChange), this.addEventListener("pointerdown", this._keepCtrlAlive, !0), this.addEventListener("pointermove", this._keepCtrlAlive, !0), this.addEventListener("pointerdown", this._onPressCapture, !0), this.addEventListener("pointerup", this._onReleaseCapture, !0), this.addEventListener("pointercancel", this._onCancelCapture, !0), this.addEventListener("click", this._onClickCapture, !0), this._visObserver = new IntersectionObserver(
      (e) => {
        this._hostIntersecting = e[e.length - 1].isIntersecting, this._onDocVisibility();
      },
      { threshold: 0 }
    ), this._visObserver.observe(this), document.addEventListener("visibilitychange", this._onDocVisibility), this._stageWatch = setInterval(() => this._checkStage(), 1e3), this.hasUpdated && (this._reattached = !0, this.requestUpdate());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), clearInterval(this._stageWatch), this._mode === "recorded" && (this._resumeAt = this._player.wallTime ?? this._resumeAt, this._resumePaused = this._followPaused), this._loadedForTime = void 0, this._resetAudioSession(), clearTimeout(this._followCtrlTimer), clearTimeout(this._scrubFineTimer), clearTimeout(this._livePreviewWarmTimer), this._releaseFrame(), document.removeEventListener("fullscreenchange", this._onFsChange), this.removeEventListener("pointerdown", this._keepCtrlAlive, !0), this.removeEventListener("pointermove", this._keepCtrlAlive, !0), this.removeEventListener("pointerdown", this._onPressCapture, !0), this.removeEventListener("pointerup", this._onReleaseCapture, !0), this.removeEventListener("pointercancel", this._onCancelCapture, !0), this.removeEventListener("click", this._onClickCapture, !0), clearTimeout(this._pendingTap?.timer), this._pendingTap = void 0, this._visObserver?.disconnect(), this._visObserver = void 0, document.removeEventListener("visibilitychange", this._onDocVisibility), clearTimeout(this._suspendTimer), this._suspended = !1, this._player.suspend(), this._resetPreviewSlots(), this._preview.destroy(), qt(this.renderRoot);
  }
  willUpdate(e) {
    if (this.clipEndTime > 0 && (e.has("targetTime") || e.has("cameraId")) || e.has("cameraId") ? this._releaseFrame() : e.has("scrubbing") && !this.scrubbing && this._holdFrame(!0), e.has("cameraId") && (this._loadedForTime = void 0), e.has("scrubbing") && !this.scrubbing)
      for (const i of [this._previewVidA, this._previewVidB]) i && At(i);
  }
  _onHostVisibility(e) {
    e !== !this._hidden && (this._hidden = !e, clearTimeout(this._suspendTimer), this._hidden ? (this._resumeOnShow = !this.live && !this.scrubbing && this._mode === "recorded" && !this._followPaused, this._resetAudioSession(), this._muteAndPauseAll(), this._suspendTimer = setTimeout(() => this._suspend(), Tr)) : this._suspended ? this._unsuspend() : this._resumeAfterVisible());
  }
  /** Hidden for a while (a closed popup, a view HA keeps cached behind another,
   *  the screen off): let go of EVERYTHING, exactly as a detach would. Pausing
   *  is not enough — a paused player keeps its decoder, and a live stream keeps
   *  coming. A hidden card on the wall tablet once held its decoders for hours
   *  and still had them when the viewer opened live fullscreen on top of it. */
  _suspend() {
    !this._hidden || this._suspended || (this._mode === "recorded" && (this._resumeAt = this._player.wallTime ?? this._resumeAt ?? this.targetTime, this._resumePaused = this._followPaused, this._loadedForTime = void 0), this._player.suspend(), this._resetPreviewSlots(), this._suspended = !0);
  }
  _unsuspend() {
    this._suspended = !1, this._reattached = !0, this._resumeOnShow = !1;
  }
  /** Silence + pause every player (the footage, the scrub previews) so
   *  nothing plays audio while the card is hidden. Live stops its stream. */
  _muteAndPauseAll() {
    this._mode === "live" && this._player.pause();
    for (const e of [this._mainVideo, this._previewVidA, this._previewVidB])
      if (e) {
        e.muted = !0;
        try {
          e.pause();
        } catch {
        }
      }
  }
  /** Re-shown after a short hide (no suspend). LIVE goes back to the live
   *  edge unless the user had paused it. Recorded footage that was PLAYING
   *  resumes too: becoming visible again IS the return (re-opening the popup),
   *  and staying paused looked like a picture frozen for no reason. */
  _resumeAfterVisible() {
    if (this.live) {
      !this._livePausedState && !this.scrubbing && this._startLive();
      return;
    }
    const e = this._resumeOnShow;
    this._resumeOnShow = !1;
    const t = this._mainVideo;
    e && !this.scrubbing && this._mode === "recorded" && t && (t.muted = this._followMuted, this._player.play());
  }
  /** Last line of defence for recorded playback.
   *
   *  The engine recovers what it can see (a seek that does not land, a stream
   *  that fails or goes quiet). This watches the RESULT: footage that is
   *  settled, not paused by the user and not advancing gets a play() nudge
   *  after 2.5 s, and a clean restart from the frame on screen after 6 s.
   *  Every state in which "not advancing" is legitimate — user pause,
   *  tap-to-play, waiting for footage (a seek, the recording edge), the end of
   *  an event, scrubbing, hidden — is excluded. */
  _checkStage() {
    const e = this._mainVideo;
    if (!e || this._mode !== "recorded" || this._hidden || document.hidden || this.live || this.scrubbing || this._waiting || this._followPaused || this._tapToPlay || this._error || !this._player.settled || this._player.atBound) {
      this._stageStuckSince = 0, this._stageLastCt = -1;
      return;
    }
    const t = e.currentTime, i = !e.paused && t !== this._stageLastCt;
    if (this._stageLastCt = t, i) {
      this._stageStuckSince = 0;
      return;
    }
    const s = performance.now();
    if (!this._stageStuckSince) {
      this._stageStuckSince = s;
      return;
    }
    const r = s - this._stageStuckSince;
    if (r < 2500) return;
    if (r < 6e3) {
      e.paused && this._playFollowVideo(e);
      return;
    }
    const o = this._player.wallTime ?? this.targetTime;
    if (this._stageStuckSince = 0, this._stageLastCt = -1, this._stageRestarts = this._stageRestarts.filter((n) => s - n < 12e4), this._stageRestarts.length >= 2) {
      this._reportPlaybackProblem(`playback stalled ${Math.round(r / 1e3)}s — giving up`), e.pause(), this._error = "Playback keeps stalling on this device. Tap an event or the timeline to try again.";
      return;
    }
    this._stageRestarts.push(s), this._reportPlaybackProblem(`playback stalled ${Math.round(r / 1e3)}s — restarting`), this._player.seek(o, { play: !0 });
  }
  /** Tell the card whether LIVE is playing: it pins the playhead to now only
   *  while it is, and on a resume it snaps back to now (live resumes at the
   *  live edge). */
  _reportLivePlaying(e) {
    this._livePausedState = !e, e !== this._lastLivePlaying && (this._lastLivePlaying = e, this.dispatchEvent(
      new CustomEvent("live-playing", {
        detail: { playing: e },
        bubbles: !0,
        composed: !0
      })
    ));
  }
  // ---- the player's hooks ----------------------------------------------------
  /** Every presented frame of the current seek / live switch (wall-clock ms). */
  _onFrame(e) {
    if (this._blank && (this._blank = !1), this._frozen && this._releaseFrame(), this._mode !== "recorded" || this.scrubbing) return;
    const t = performance.now(), i = this._lastWallReported === void 0 ? void 0 : this._lastWallReported + (t - this._lastTimeReport) * (this._mainVideo?.playbackRate ?? 1);
    if (!(i === void 0 || Math.abs(e - i) > 1e3) && t - this._lastTimeReport < Er) return;
    this._lastTimeReport = t, this._lastWallReported = e, this.dispatchEvent(
      new CustomEvent("playback-time", { detail: { time: e }, bubbles: !0, composed: !0 })
    ), this.clipEndTime > 0 && (this._followNow = e);
    const r = Date.now() - e < Ie;
    r !== this._nearLive && (this._nearLive = r), r && this._followRate !== 1 && this._setFollowRate(1);
  }
  /** Loading / settled / failed changed. */
  _onPlayerChange() {
    const e = this._player.loading;
    if (e !== this._waiting && (this._waiting = e), this._mode === "live" && this._player.settled && !this._liveSettled) {
      this._liveSettled = !0, this._scheduleLivePreviewWarm();
      const t = this._mainVideo;
      t && Cs(this.liveAudioStart, this._audioUserChoice, this._liveAudioAttempted) && this._tryAutoLiveAudio(t);
    }
  }
  // ---- what the stage plays ---------------------------------------------------
  /** Bind the player to the <video> and the camera (cheap when unchanged). A
   *  camera change drops everything loaded and hides the old picture. */
  _syncPlayer() {
    const e = this._mainVideo;
    e && this._player.video !== e && this._player.attach(e), this._player.setSource(this.nvrId, this.cameraId, 0) && (this._blank = !0);
  }
  /** Follow the live edge — in the same element, so whatever is on screen
   *  stays until the first live frame. */
  _startLive() {
    this._mode = "live", this._error = void 0, this._tapToPlay = !1, this._followNow = void 0, this._nearLive = !1, this._resetLiveSession();
    const e = this._mainVideo;
    e && (e.muted = this._liveMuted), this._player.live(), this._reportLivePlaying(!0), this._flashFollowCtrl();
  }
  /** Play recorded footage from `at` (an event's start, a tapped time, where a
   *  hidden card left off). `fresh`: a new selection, so the old picture is
   *  hidden until the new one presents. */
  _playRecorded(e, t = {}) {
    this._mode = "recorded", this._error = void 0, this._tapToPlay = !1, this._nearLive = !1, this._followPaused = !(t.play ?? !0), t.fresh && (this._blank = !0), this._player.setBound(this._eventEnd || null);
    const i = this._mainVideo;
    i && (i.muted = this._followMuted), this._player.setRate(this._followRate), this._seekRecorded(e), this._flashFollowCtrl();
  }
  /** Position recorded playback at `tIn` (clamped to the event / what exists). */
  _seekRecorded(e) {
    let t = Math.max(this._seekFloor, Math.min(e, this._seekCeiling));
    !this._player.isLoaded(t) && !this._eventEnd && (t = Math.min(t, Date.now() - Gt)), this._followNow = t, this._lastWallReported = void 0, this._player.seek(t, { play: !this._followPaused });
  }
  firstUpdated() {
    this._fsDlg && (this._fsDlg.open = !0), this.startFs && (this.stacked ? (this._forceRotate = window.innerHeight > window.innerWidth, this._isFs = !0) : this.requestFullscreen?.().catch(() => {
    }));
  }
  updated(e) {
    if (e.has("_isFs") && this.stacked && this._syncFsDialog(), this.stacked && !this._isFs && !this._modalOn && this._fsDlg && !this._fsDlg.open && (this._fsDlg.open = !0), e.has("_followCtrl") || e.has("_isFs"))
      for (const i of this.querySelectorAll('[slot="fs-timeline"]'))
        i.toggleAttribute("inert", !this._followCtrl);
    if (e.has("_isFs") && e.get("_isFs") === !0 && !this._isFs && this.startFs && this.dispatchEvent(new CustomEvent("fs-exit", { bubbles: !0, composed: !0 })), e.has("scrubbing") && (clearTimeout(this._scrubFineTimer), this._scrubFineTimer = void 0, this.scrubbing || this._preview.abortSheets(), this.scrubbing ? clearTimeout(this._followCtrlTimer) : this._followCtrl && this._showFollowCtrl()), (e.has("_isFs") || e.has("_forceRotate")) && this.dispatchEvent(
      new CustomEvent("fs-change", {
        detail: { fs: this._isFs, rotated: this._isFs && this._forceRotate },
        bubbles: !0,
        composed: !0
      })
    ), !this.hass || !this.nvrId || !this.cameraId || (e.has("previewDir") && (this._resetPreviewSlots(), this._previewToken++, this._warmPreview()), e.has("scrubbing") && this.scrubbing && (this._scrubVelPrev = void 0, this._coarseScrub = !1, clearTimeout(this._scrubFineTimer), this._scrubFineTimer = void 0, this._spriteReady = !1, this._warmPreview()), this._suspended)) return;
    this._syncPlayer();
    const t = this._reattached;
    if (this._reattached = !1, e.has("scrubbing") && this.scrubbing) {
      this._player.pause(), this._loadedForTime = void 0, this._resumeAt = void 0, this._error = void 0, this._updatePreview();
      return;
    }
    if (this.scrubbing) {
      (e.has("targetTime") || e.has("previewDir")) && this._updatePreview();
      return;
    }
    if (this.live)
      (t || this._mode !== "live" || e.has("live") || e.has("scrubbing") || e.has("cameraId")) && (this._loadedForTime = void 0, this._startLive());
    else if (t || e.has("scrubbing") || e.has("targetTime") || e.has("live") || e.has("cameraId")) {
      if (this._loadedForTime !== this.targetTime || t) {
        this._loadedForTime = this.targetTime;
        const i = t && this._resumeAt !== void 0 ? this._resumeAt : void 0, s = i !== void 0 && this._resumePaused;
        this.clipEndTime > this.targetTime + 500 ? (i === void 0 && (this._eventEndSent = !1), this._followNow = void 0, this._playRecorded(i ?? this.targetTime, {
          fresh: i === void 0,
          play: !s && !(i !== void 0 && this._eventEndSent)
        })) : this._playRecorded(i ?? this.targetTime, {
          fresh: e.has("cameraId"),
          play: !s
        });
      }
      this._resumeAt = void 0;
    }
  }
  // ---- scrub preview --------------------------------------------------------
  /** The FINE unit covering `t`: a plain block, or — for blocks split at
   *  event boundaries — the covering PART file (resolved via the sidecar map). */
  async _resolveFine(e) {
    const t = this._preview.blockFor(e);
    if (t)
      return t.mapped ? this._preview.resolvePart(t, e) : t;
  }
  /** The best unit available for `t` RIGHT NOW — level of detail, not a fixed
   *  tier.
   *
   *  A drag across hours crosses dozens of 10-minute blocks; only the ones the
   *  playhead lingers in ever get fetched, so the stage used to hold a single
   *  frozen frame for the whole gesture. The hour-long overview units are a
   *  fraction of the bytes and can be kept warm, so if the fine unit isn't in
   *  hand yet we show the overview immediately and let the fine download
   *  continue underneath. The upgrade needs no extra machinery: an overview
   *  block is just another PreviewBlock, so the existing a/b leap-frog stages,
   *  seeks and promotes it exactly like any other, and the fine unit replaces
   *  it through the standby slot the moment it arrives. */
  /** PERF-SCRUB-2026-08-03: sample the playhead's speed and latch whether the
   *  fine tier can keep up. Called EXACTLY ONCE per retarget, from
   *  _updatePreview — _resolvePlayable is called twice per retarget (once to
   *  pick a unit, once to re-check it after a download), and sampling there
   *  would feed it a zero-delta second sample and drop straight back out of
   *  coarse mode. */
  _updateScrubSpeed(e) {
    const t = performance.now(), i = this._scrubVelPrev;
    this._scrubVelPrev = { t: e, at: t };
    const s = i ? t - i.at : 0, r = i && s > 0 && s <= Ht ? Math.abs(e - i.t) / s : 0;
    if (i && e !== i.t && (this._scrubDir = e > i.t ? 1 : -1), this.fastPreview === "off") {
      this._coarseScrub = !1;
      return;
    }
    if (this.fastPreview === "always") {
      this._coarseScrub = !!i && e !== i.t && s > 0 && s <= Ht;
      return;
    }
    const o = this._preview.blockMs();
    this._coarseScrub = this._coarseScrub ? r > o / br : r > o / gr;
  }
  _scheduleFineScrubUpgrade() {
    clearTimeout(this._scrubFineTimer), this._scrubFineTimer = void 0, !(!this._coarseScrub || !this.scrubbing) && (this._scrubFineTimer = setTimeout(() => {
      this._scrubFineTimer = void 0, this.scrubbing && this._updatePreview();
    }, Ht + 25));
  }
  async _resolvePlayable(e) {
    if (this._coarseScrub) {
      const r = this._preview.overviewBlockFor(e);
      if (r) {
        if (this._unitReady(r) || (this._prefetchUnit(r), this._useSprites())) return r;
        if (this._previewActive) return;
      }
    }
    const t = this._preview.tipBlockFor(e, this._preview.headEnd());
    if (t) {
      if (this._preview.isCached(t)) return t;
      this._preview.getBlock(t).then((r) => {
        r && this.scrubbing && this._updatePreview();
      });
    }
    const i = await this._resolveFine(e);
    if (i && this._unitReady(i)) return i;
    const s = this._preview.overviewBlockFor(e);
    return s && this._unitReady(s) ? (i && this._prefetchUnit(i), s) : i ?? s;
  }
  // ---- sprite tier (SPRITE-PREVIEW-2026-08-04) ------------------------------
  /** Whether the scrub preview paints from JPEG mosaics rather than by seeking
   *  a <video>. 'auto' defers to what this device measured (see _noteSeek). */
  _useSprites() {
    return this.previewMode === "sprites" ? !0 : this.previewMode === "video" ? !1 : this._autoSprites;
  }
  _spriteVariants(e) {
    return Ws(
      this._coarseScrub,
      this._preview.hasSprites(e),
      this._preview.hasFastSprites(e)
    );
  }
  _spriteIfLoaded(e, t) {
    return t === "fast" ? this._preview.fastSpriteIfLoaded(e) : this._preview.spriteIfLoaded(e);
  }
  _getSprite(e, t) {
    return t === "fast" ? this._preview.getFastSprite(e) : this._preview.getSprite(e);
  }
  async _preferredSprite(e) {
    for (const t of this._spriteVariants(e)) {
      const i = await this._getSprite(e, t);
      if (i) return { set: i, variant: t };
    }
  }
  /** Feed one observed seek latency into the 'auto' decision.
   *
   *  Measuring beats sniffing here: the Android tablet this tier exists for
   *  reports a DESKTOP Linux user agent (Chrome's desktop-site mode), so a
   *  platform check fails on the exact device that needs it — while a Mac or
   *  iPhone seeks in ~10 ms and can never cross the threshold no matter what it
   *  claims to be. One-way on purpose: a device that has proved slow shouldn't
   *  flip back mid-session on one lucky sample. */
  _noteSeek(e) {
    if (this._autoSprites || this.previewMode !== "auto" || (this._seekSamples.push(e), this._seekSamples.length < yr)) return;
    this._seekSamples.length > xr && this._seekSamples.shift();
    const t = this._seekSamples.slice().sort((s, r) => s - r);
    t[Math.floor(t.length / 2)] > wr && (this._autoSprites = !0, this.requestUpdate());
  }
  /** Paint the frame for `t` from the sprite sheets. Returns false when this
   *  unit has no atlas (tip, mapped part, or a block the job hasn't reached),
   *  so the caller can fall back to the video path for it. */
  async _drawSprite(e, t) {
    const i = await this._preferredSprite(e);
    if (!i) return !1;
    const { set: s } = i, r = s.cols * s.rows, o = this._spriteToken;
    let n = this._preview.tileIndexFor(e, s, t);
    const a = Math.floor(n / r), h = s.sheets[a];
    if (!h) return !0;
    let u = this._preview.hasSheet(h) ? await this._preview.getSheet(h) : void 0;
    if (u || (u = await this._preview.getSheet(h)), !u || !this.scrubbing || o !== this._spriteToken || (n = this._preview.tileIndexFor(e, s, this.targetTime), Math.floor(n / r) !== a)) return !0;
    const d = this._preview.tileAt(s, n);
    if (!d) return !0;
    const l = this._spriteCanvas;
    if (!l) return !0;
    (l.width !== s.tileW || l.height !== s.tileH) && (l.width = s.tileW, l.height = s.tileH);
    const _ = l.getContext("2d");
    if (!_) return !0;
    try {
      _.drawImage(u, d.sx, d.sy, s.tileW, s.tileH, 0, 0, s.tileW, s.tileH);
    } catch {
      return !0;
    }
    return this._spriteReady || (this._spriteReady = !0), this._frozen && this._releaseFrame(), !0;
  }
  /** Keep the sheet covering `t` — and its neighbours — decoded, so continued
   *  dragging doesn't stall on a fetch. Fire-and-forget; the loader dedups and
   *  its LRU bounds the memory. */
  async _warmSprites(e, t) {
    const i = await this._preferredSprite(e);
    if (!i) return;
    const { set: s } = i, r = s.cols * s.rows, o = e.end - e.start;
    if (o <= 0) return;
    const n = Math.min(1, Math.max(0, (t - e.start) / o)), a = Math.floor(Math.min(s.count - 1, Math.floor(n * s.count)) / r), h = this._scrubDir || 1;
    for (const u of this._coarseScrub ? [a, a + h] : [a, a - 1, a + 1]) {
      const d = s.sheets[u];
      d && !this._preview.hasSheet(d) && this._preview.getSheet(d, !0);
    }
  }
  /** Pull whichever representation of a unit this device will actually PAINT.
   *  SPRITE-PREVIEW-2026-08-04: without this, sprite mode still downloaded
   *  every ~490 KB mp4 block it flew over — bytes that can never reach the
   *  screen, and on the tablet the staging that comes with them is exactly the
   *  decoder work this tier exists to avoid. */
  _prefetchUnit(e) {
    if (this._useSprites() && this._spriteVariants(e).length) {
      this._warmSprites(e, this.targetTime);
      return;
    }
    this._preview.isCached(e) || this._preview.getBlock(e);
  }
  /** "Already in hand", for whichever representation is in use — the tier
   *  choice in _resolvePlayable is about what can be shown WITHOUT waiting, and
   *  in sprite mode that is a decoded sheet, not an mp4 blob. */
  _unitReady(e) {
    if (this._useSprites() && this._spriteVariants(e).length) {
      for (const t of this._spriteVariants(e)) {
        const i = this._spriteIfLoaded(e, t);
        if (!i) continue;
        const s = this._preview.tileFor(e, i, this.targetTime);
        if (s && this._preview.hasSheet(s.sheet)) return !0;
      }
      return !1;
    }
    return this._preview.isCached(e);
  }
  _previewVideo(e) {
    return e === "a" ? this._previewVidA : this._previewVidB;
  }
  _previewSrcOf(e) {
    return e === "a" ? this._previewSrcA : this._previewSrcB;
  }
  /** Pull the preview index (and the unit covering the playhead) into cache
   *  BEFORE a scrub needs it — on mount and on pointer-down.
   *
   *  A freshly mounted card has an empty loader, so the first drag had to fetch
   *  index.json, then any sidecar map, then the block itself, all serialized on
   *  the gesture's critical path; every step downstream is gated on `scrubbing`
   *  still being true, so on anything slower than a LAN the bytes landed after
   *  the gesture had already ended and the whole download was thrown away —
   *  the user had to scrub repeatedly before a frame appeared. The tablet never
   *  showed this because its card lives in a pop-up that is never unmounted, so
   *  the loader is warm from the first use onward; the phone opens a brand new
   *  view (and a brand new card) every time. */
  async _warmPreview() {
    if (!this.previewDir || !this.hass || (this._preview.configure(this.hass, this.previewDir), this._preview.setTipEnabled(this.tipEnabled), this._preview.onTipUpdate = () => {
      this.scrubbing && this._updatePreview();
    }, this.scrubbing && this.tipEnabled && this.targetTime > Date.now() - Oe && this._preview.requestTip(), await this._preview.ensureIndex(this.targetTime), !this.scrubbing)) return;
    const e = await this._resolveFine(this.targetTime);
    e && this._prefetchUnit(e), this._warmOverview(this.targetTime);
  }
  /** Keep the overview units around `t` in cache. Fire-and-forget; the loader
   *  dedups and its LRU bounds the memory. */
  _warmOverview(e) {
    for (const i of [e, e - 36e5, e + 36e5]) {
      const s = this._preview.overviewBlockFor(i);
      s && this._prefetchUnit(s);
    }
  }
  _scheduleLivePreviewWarm() {
    this._livePreviewWarmed || this._livePreviewWarmTimer !== void 0 || (this._livePreviewWarmTimer = setTimeout(() => {
      this._livePreviewWarmTimer = void 0, !(!this.live || this._hidden || this.scrubbing) && (this._livePreviewWarmed = !0, this._warmLiveFastPreview());
    }, 500));
  }
  async _warmLiveFastPreview() {
    if (!this.previewDir || !this.hass) return;
    this._preview.configure(this.hass, this.previewDir), await this._preview.ensureIndex(this.now);
    const e = await this._resolveFine(this.now);
    if (!e || !this._preview.hasFastSprites(e)) return;
    const t = await this._preview.getFastSprite(e), i = t ? this._preview.tileFor(e, t, this.now) : void 0;
    i && !this._preview.hasSheet(i.sheet) && await this._preview.getSheet(i.sheet);
  }
  /** Point the preview at the unit covering targetTime: seek within the shown
   *  unit, or load the covering one into the STANDBY element and promote it
   *  once its frame has decoded — the active element never blanks. A time with
   *  no cached coverage keeps the last shown frame (UniFi-style). */
  async _updatePreview() {
    if (!this.previewDir || !this.hass || (this._preview.configure(this.hass, this.previewDir), await this._preview.ensureIndex(this.targetTime), this.tipEnabled && this.targetTime > Date.now() - Oe && (this._preview.requestTip(), this._preview.ensureTip()), !this.scrubbing)) return;
    this._updateScrubSpeed(this.targetTime), this._scheduleFineScrubUpgrade(), this._warmOverview(this.targetTime);
    const e = await this._resolvePlayable(this.targetTime);
    if (!e || !this.scrubbing) return;
    if (this._useSprites()) {
      if (this._warmSprites(e, this.targetTime), await this._drawSprite(e, this.targetTime)) return;
      this._spriteReady = !1;
    }
    const t = this._previewActive;
    if (t && this._previewBlocks[t]?.key === e.key) {
      this._seekPreview(t);
      for (const r of [e.start - 1, e.end + 1]) {
        const o = this._preview.blockFor(r);
        o && !o.mapped && o.key !== e.key && this._preview.getBlock(o);
      }
      return;
    }
    const i = this._standbySlot();
    if (this._previewBlocks[i]?.key === e.key && this._previewSrcOf(i)) {
      this._seekPreview(i);
      return;
    }
    if (this._previewWant === e.key) return;
    this._previewWant = e.key;
    const s = ++this._previewToken;
    try {
      if (!this._preview.isCached(e) && (await new Promise((o) => setTimeout(o, 120)), s !== this._previewToken || !this.scrubbing))
        return;
      const r = await this._preview.getBlock(e);
      if (!r || s !== this._previewToken || this.scrubbing && (await this._resolvePlayable(this.targetTime))?.key !== e.key || s !== this._previewToken) return;
      this._loadPreviewInto(this._standbySlot(), e, r);
    } finally {
      this._previewWant === e.key && (this._previewWant = void 0);
    }
  }
  /** The slot NOT currently on screen (slot 'a' when nothing is shown yet). */
  _standbySlot() {
    return this._previewActive === "a" ? "b" : "a";
  }
  /** Stage a unit in one slot. Only the standby is ever restaged, so the frame
   *  the user is looking at survives the whole load → seek → decode cycle. */
  _loadPreviewInto(e, t, i) {
    this._previewBlocks[e] = t, this._previewPending[e] = void 0, this._previewRetries[e] = 0, e === "a" ? this._previewSrcA = i : this._previewSrcB = i, this._preview.setPinned([this._previewSrcA, this._previewSrcB]), this._seekPreview(e);
  }
  /** Seek a (paused, muted) preview video to the frame for targetTime.
   *  The playable unit (a whole block, or one event-boundary part) covers
   *  [start, end] linearly and the element's own duration is the ground truth
   *  — no server-side timing bookkeeping can drift. Times past a head block's
   *  end clamp to its newest frame. Seeks are throttled seek-at-a-time: while
   *  the decoder is busy we remember only the LATEST wanted time and apply it
   *  on `seeked` — rapid scrub moves never queue up. */
  _seekPreview(e) {
    const t = this._previewVideo(e), i = this._previewBlocks[e];
    if (!t || !i) return;
    const s = t.duration;
    if (!isFinite(s) || s <= 0) return;
    const r = Math.min(1, Math.max(0, (this.targetTime - i.start) / (i.end - i.start))), o = Math.min(r * s, Math.max(0, s - 0.05));
    if (Math.abs(t.currentTime - o) < 0.02) {
      e !== this._previewActive && this._promotePreview(e);
      return;
    }
    if (t.seeking) {
      this._previewPending[e] = o;
      return;
    }
    if (this._previewPending[e] = void 0, this.previewMode === "auto") {
      const n = performance.now(), a = () => {
        t.removeEventListener("seeked", a), this._noteSeek(performance.now() - n);
      };
      t.addEventListener("seeked", a, { once: !0 });
    }
    t.currentTime = o;
  }
  /** Show a standby slot: a class swap only (no transition). Refuses to promote
   *  a unit whose frame isn't decoded yet (that would blank the stage — the
   *  whole point of the swap) or one the user has already scrubbed away from. */
  _promotePreview(e) {
    const t = this._previewBlocks[e];
    if (!t || !this.scrubbing || e === this._previewActive) return;
    const i = this._previewVideo(e);
    !i || i.readyState < 2 || this.targetTime < t.start || !t.head && !t.tip && this.targetTime > t.end || (this._previewActive = e);
  }
  _onPreviewMeta(e) {
    this._seekPreview(e);
  }
  // First frame decoded. Re-runs the seek so a unit that needed no seek (the
  // target frame is where the decoder opened) still gets promoted.
  _onPreviewLoaded(e) {
    this._seekPreview(e);
  }
  // Some decoders (distro chromium's openh264, notably) can throw a DECODE
  // error on a backward seek within an already-loaded preview. The blob is
  // fine — reload the element and re-seek (loadedmetadata re-runs the seek).
  // Bounded per unit; a persistent failure just keeps the last good frame.
  _onPreviewError(e) {
    if (e === this._previewActive) {
      const s = this._previewBlocks[e], r = this._previewSrcOf(e);
      s && r && this._previewRetries[e] < 2 && (this._previewRetries[e]++, this._loadPreviewInto(this._standbySlot(), s, r));
      return;
    }
    const t = this._previewVideo(e), i = this._previewSrcOf(e);
    !t || !i || this._previewRetries[e] >= 2 || (this._previewRetries[e]++, this._previewPending[e] = void 0, t.removeAttribute("src"), t.load(), t.src = i);
  }
  _onPreviewSeeked(e) {
    const t = this._previewVideo(e), i = this._previewPending[e];
    if (this._previewPending[e] = void 0, t && i !== void 0 && Math.abs(t.currentTime - i) > 0.02) {
      t.currentTime = i;
      return;
    }
    this._promotePreview(e);
  }
  /** Drop both preview slots (camera switch / teardown). */
  _resetPreviewSlots() {
    this._previewSrcA = void 0, this._previewSrcB = void 0, this._previewActive = null, this._previewBlocks = { a: void 0, b: void 0 }, this._previewPending = { a: void 0, b: void 0 }, this._previewRetries = { a: 0, b: 0 }, this._previewWant = void 0, this._spriteReady = !1, this._spriteToken++, this._preview.setPinned([]);
  }
  /** Seconds -> "M:SS" (e.g. 5 -> "0:05", 75 -> "1:15"). */
  _fmtClock(e) {
    (!isFinite(e) || e < 0) && (e = 0);
    const t = Math.floor(e / 60), i = Math.floor(e % 60);
    return `${t}:${i.toString().padStart(2, "0")}`;
  }
  // ---- recorded playback: limits, the event end, seeking --------------------
  /** Lowest instant playback may seek to: an event's start while one is being
   *  played (its seek bar starts there), else anything. */
  get _seekFloor() {
    return this.clipEndTime > 0 ? this.targetTime : 0;
  }
  /** The latest instant recorded playback can be positioned at: an event's
   *  end, else just short of now (footage near now comes from the live buffer
   *  or not at all — see _seekRecorded). */
  get _seekCeiling() {
    const e = Date.now() - 1e3, t = this._eventEnd;
    return t ? Math.min(t - 250, e) : e;
  }
  /** The end of the event being played, never later than the NVR has recorded;
   *  0 when no event is (continuous timeline playback). Playback STOPS here. */
  get _eventEnd() {
    return this.clipEndTime > this.targetTime ? Math.min(this.clipEndTime, Date.now() - Gt) : 0;
  }
  /** The event's end has played: the player paused on its last frame; tell
   *  the host (once). Nothing follows it — rolling on into what came next read
   *  as "switching streams". Play replays the event; a skip or seek resumes it. */
  _finishEvent() {
    this._followPaused = !0, this._eventEndSent || (this._eventEndSent = !0, this.dispatchEvent(new CustomEvent("clip-ended", { bubbles: !0, composed: !0 }))), this._showFollowCtrl();
  }
  /** Seek recorded playback to `t` — the seek bar, ±15 s, Play after an event
   *  ended. Inside what is loaded this is a native seek; elsewhere the NVR
   *  streams from there into the same buffer. Either way the frame on screen
   *  stays until the new one is ready, and the seek bar holds where it was let
   *  go (the player reports no time from the old position meanwhile). */
  _seekFollowTo(e) {
    const t = Math.max(this._seekFloor, Math.min(e, this._seekCeiling));
    (this._eventEndSent || this._player.atBound) && (this._eventEndSent = !1, this._followPaused = !1), this._announceSeek(t), this._seekRecorded(t), this._showFollowCtrl();
  }
  /** Start a follow slot playing, and DON'T lose the failure.
   *
   *  Every play() here used to be `.catch(() => {})`, so a refusal left a
   *  decoded first frame parked on screen looking exactly like a stalled
   *  download — the "snapshot appears but nothing plays" report. A rejection is
   *  normally the autoplay policy, so retry muted (permitted in far more
   *  situations); if even that is refused — iOS Low Power Mode blocks autoplay
   *  outright, muted or not — surface a tap target, since a user gesture always
   *  gets through. */
  _playFollowVideo(e) {
    e.play().then(() => {
      this._tapToPlay = !1;
    }).catch((t) => {
      Be(t) && (e.muted = !0, e.play().then(() => {
        this._tapToPlay = !1, this._audioUserChoice === "unmuted" && (e.volume = 1, e.muted = !1);
      }).catch((i) => {
        Be(i) && (this._tapToPlay = !0);
      }));
    });
  }
  _reportPlaybackProblem(e) {
    console.warn(`[unifi-timeline] ${e}`);
    const t = Date.now();
    f._problemTimes = f._problemTimes.filter((i) => t - i < 36e5), !(f._problemTimes.length >= 10 || !this.hass) && (f._problemTimes.push(t), this.hass.callWS({
      type: "call_service",
      domain: "system_log",
      service: "write",
      service_data: {
        message: `unifi-protect-timeline-card: ${e} — ${this.cameraId} — ${navigator.userAgent}`,
        level: "warning",
        logger: "unifi_protect_timeline_card"
      }
    }).catch(() => {
    }));
  }
  /** Mean luminance over a small sample; a copy this dark is a failed copy. */
  _looksBlack(e, t) {
    try {
      const i = Math.min(32, t.width), s = Math.min(32, t.height);
      if (!i || !s) return !0;
      const r = e.getImageData(0, 0, i, s).data;
      let o = 0;
      for (let n = 0; n < r.length; n += 4) o += (r[n] + r[n + 1] + r[n + 2]) / 3;
      return o / (r.length / 4) < 3;
    } catch {
      return !0;
    }
  }
  /** The scrub layer's preview <video> on screen, if it holds a frame. */
  _visibleVideo() {
    const e = this._previewActive ? this._previewVideo(this._previewActive) : void 0;
    return e && e.readyState >= 2 && e.videoWidth > 0 ? e : void 0;
  }
  /** Copy what the scrub layer shows onto the overlay canvas and hold it until
   *  the player presents the footage (see _onFrame), or a backstop. No-op when
   *  there is nothing to copy — a black hold is worse than the honest frame.
   *  `preferSprite`: the sprite canvas first (it is what is on screen in sprite
   *  mode, and holds exactly the instant scrubbed to). */
  _holdFrame(e = !1) {
    const t = oi ? void 0 : this._visibleVideo(), i = this._spriteReady && this._spriteCanvas && this._spriteCanvas.width > 0 ? this._spriteCanvas : void 0, r = (e ? [i, t] : [t, i]).find((d) => !!d), o = this._freezeCanvas;
    if (!r || !o) return;
    const n = r instanceof HTMLCanvasElement, a = n ? r.width : r.videoWidth, h = n ? r.height : r.videoHeight;
    if (!a || !h) return;
    let u = !1;
    try {
      (o.width !== a || o.height !== h) && (o.width = a, o.height = h);
      const d = o.getContext("2d", { willReadFrequently: !0 });
      d?.clearRect(0, 0, o.width, o.height), d?.drawImage(r, 0, 0, o.width, o.height), u = !!d && !this._looksBlack(d, o);
    } catch {
      u = !1;
    }
    u && (this._frozen = !0, o.removeAttribute("hidden"), clearTimeout(this._freezeTimer), this._freezeTimer = setTimeout(
      () => this._releaseFrame(),
      this.live ? kr : Sr
    ));
  }
  _releaseFrame() {
    clearTimeout(this._freezeTimer), this._freezeTimer = void 0, this._frozen = !1, this._freezeCanvas?.setAttribute("hidden", "");
  }
  /** The automatic "here are the controls" flash when a player starts. Skipped
   *  right after the user dismissed them by hand: dragging the timeline and
   *  then tapping to clear the chrome starts playback a beat later, and that
   *  must not undo the tap. */
  _flashFollowCtrl() {
    Date.now() - this._ctrlDismissedAt < 1500 || this._showFollowCtrl();
  }
  /** The press is on something with its own job, not on the picture. The
   *  control bar's empty stretch is NOT one: it is a gradient over the video,
   *  and a tap there means the same as a tap on the picture. */
  _isControlTarget(e) {
    for (const t of e.composedPath()) {
      if (t === this) break;
      if (t instanceof Element && t.matches(
        "button, input, select, a, .vseek, .tap-play, .evt-wrap, .zoom-panel, .zoom-fab, .live-arrow"
      ))
        return !0;
    }
    return !1;
  }
  /** Flip what the user SAW at the press — not the state now, which hovering
   *  or the auto-hide may have changed in between. */
  _commitTap() {
    const e = this._pendingTap;
    this._pendingTap = void 0, e && (clearTimeout(e.timer), e.visible ? this._hideFollowCtrl() : this._showFollowCtrl());
  }
  /** Promote/demote the player dialog to/from the top layer to match _isFs.
   *  Enter uses `open = false` (not close()) to demote the inline dialog so no
   *  spurious `close` event fires — close() dispatches its event asynchronously,
   *  which would otherwise race _onDlgClose and toggle us straight back out. */
  _syncFsDialog() {
    const e = this._fsDlg;
    if (e)
      if (this._isFs) {
        if (!this._modalOn) {
          e.open && (e.open = !1);
          try {
            e.showModal(), this._modalOn = !0;
          } catch {
          }
        }
      } else
        this._modalOn && (e.close(), this._modalOn = !1), e.open = !0;
  }
  // ---- LIVE controls, sound -----------------------------------------------------
  /** One mute choice for the whole session (live, recorded, camera switches)
   *  until the card is hidden. Unmuting resumes playback the user had not
   *  paused (a muted autoplay refusal leaves it stopped). */
  _setSessionMuted(e) {
    this._audioUserChoice = e ? "muted" : "unmuted", this._liveMuted = e, this._followMuted = e, this._liveAudioAttempted = !0;
    const t = this._mainVideo;
    if (!t || (t.muted = e, e)) return;
    t.volume = 1, !(this._mode === "live" ? this._livePausedState : this._followPaused) && t.paused && t.play().catch(() => {
    });
  }
  /** Every session starts muted (a hide ends one). */
  _resetAudioSession() {
    this._audioUserChoice = void 0, this._liveMuted = !0, this._followMuted = !0, this._liveAudioAttempted = !1, this._liveAudioTrying = !1;
    for (const e of [this._mainVideo, this._previewVidA, this._previewVidB]) e && (e.muted = !0);
  }
  /** A fresh live session: playing, muted unless the user chose sound, the
   *  scrub preview warmed again once it is on screen. */
  _resetLiveSession() {
    this._liveEpoch++, this._liveSettled = !1, this._livePausedState = !1, this._liveMuted = this._audioUserChoice !== "unmuted", clearTimeout(this._livePreviewWarmTimer), this._livePreviewWarmTimer = void 0, this._livePreviewWarmed = !1, this._liveAudioAttempted = this._audioUserChoice !== void 0, this._liveAudioTrying = !1;
  }
  /** `live_audio_start: auto`: try sound once per live session, and fall back
   *  to muted if the browser does not keep it playing. */
  async _tryAutoLiveAudio(e) {
    if (this._liveAudioTrying || this._liveAudioAttempted) return;
    this._liveAudioAttempted = !0, this._liveAudioTrying = !0;
    const t = this._liveEpoch, i = e.currentTime;
    try {
      if (e.muted = !1, await e.play(), await new Promise((s) => setTimeout(s, $r)), t !== this._liveEpoch || e !== this._mainVideo || e.paused || e.currentTime <= i + 0.01)
        throw new Error("audible autoplay did not remain active");
      this._liveMuted = !1;
    } catch {
      t === this._liveEpoch && e === this._mainVideo && (this._audioUserChoice === "unmuted" ? e.muted = !1 : (e.muted = !0, this._liveMuted = !0, await e.play().catch(() => {
      })));
    } finally {
      this._liveAudioTrying = !1;
    }
  }
  /** Tell the host we are jumping to `t` RIGHT NOW, before the seek lands: the
   *  ruler glides on the press, and the playback-time that eventually arrives
   *  is already where it is pointing. */
  _announceSeek(e) {
    this.dispatchEvent(
      new CustomEvent("playback-seek", { detail: { time: e }, bubbles: !0, composed: !0 })
    );
  }
  /** Jump exactly ±deltaMs from the frame on screen (or from the target of a
   *  seek still landing, so two quick presses add up). */
  _followSkip(e) {
    const t = this._player.wallTime;
    t != null && this._seekFollowTo(t + e);
  }
  /** Near the recording edge: skip-forward goes live, speed stays at 1x. */
  _followNearLive() {
    const e = this._player.wallTime;
    return e != null && Date.now() - e < Ie;
  }
  _setFollowRate(e) {
    this._followRate !== e && (this._followRate = e, this._player.setRate(e));
  }
  /** The custom control bar, the same for live and recorded footage. Live greys
   *  skip-forward + speed (nothing ahead of live); recorded greys speed near
   *  the recording edge (and its skip-forward goes live there). */
  _renderCtrlBar(e, t = !1) {
    t || (this._ctrlMode = e);
    const i = e === "live", s = i ? this._livePausedState : this._followPaused, r = i ? this._liveMuted : this._followMuted, o = i ? 1 : this._followRate, n = !i && this._followRate > 1, a = i || this._nearLive, h = i ? this._liveSkipBack : this._skipBack, u = i ? this._toggleLivePlay : this._toggleFollowPlay, d = this._skipFwd, l = this._toggleFollowRate, _ = i ? this._toggleLiveMute : this._toggleFollowMute, v = !i && this._nearLive ? "Go live" : "Forward 15s";
    return p`
      <div
        class="vctrl ${this._followCtrl ? "show" : ""} ${this._isFs ? "fs" : ""} ${this._fsStrip ? "fs-inset" : ""} ${t ? "inert" : ""}"
        style="--upc-fs-tl-w:${this.fsTimelineWidth}px;--upc-fs-tl-gut:${this.fsTimelineGutter}px;--upc-fs-tl-pad:${this.fsTimelinePadding}px"
        @click=${(y) => y.stopPropagation()}
      >
        <button @click=${h} title="Back 15s">
          <ha-icon icon="mdi:rewind-15"></ha-icon>
        </button>
        <button @click=${u} title=${s ? "Play" : "Pause"}>
          <ha-icon icon=${s ? "mdi:play" : "mdi:pause"}></ha-icon>
        </button>
        <button ?disabled=${i} @click=${i ? void 0 : d} title=${v}>
          <ha-icon icon="mdi:fast-forward-15"></ha-icon>
        </button>
        <button
          class="vctrl-speed ${n ? "on" : ""}"
          ?disabled=${a}
          @click=${i ? void 0 : l}
          title="Playback speed"
        >
          ${o}×
        </button>
        <button @click=${_} title=${r ? "Unmute" : "Mute"}>
          <ha-icon icon=${r ? "mdi:volume-off" : "mdi:volume-high"}></ha-icon>
        </button>
        <button class="vfs" @click=${this._toggleFs} title="Fullscreen">
          <ha-icon icon=${this._isFs ? "mdi:fullscreen-exit" : "mdi:fullscreen"}></ha-icon>
        </button>
        ${!i && this.clipEndTime > this.targetTime ? this._renderEventSeekRow() : p`<div class="vctrl-spacer"></div>`}
      </div>
    `;
  }
  /** Time readout + seek bar over the EVENT being played, start to end, in
   *  wall-clock time — the same timeline the footage is on, so a position on
   *  the bar IS an instant and seeking to it is _seekFollowTo. */
  _renderEventSeekRow() {
    const e = this.targetTime, t = Math.max(1, this.clipEndTime - e), i = this._seekDragAt ?? this._followNow ?? e, s = Math.min(t, Math.max(0, i - e)), r = s / t;
    return p`<div class="vseek-row">
      <span class="vtime">${this._fmtClock(s / 1e3)} / ${this._fmtClock(t / 1e3)}</span>
      <div class="vseek" @pointerdown=${this._onEventSeekDown}>
        <div class="vseek-track">
          <div class="vseek-fill" style="width:${r * 100}%"></div>
          <div class="vseek-knob" style="left:${r * 100}%"></div>
        </div>
      </div>
    </div>`;
  }
  _eventSeekAt(e, t) {
    const i = t.getBoundingClientRect(), s = this._forceRotate ? (e.clientY - i.top) / i.height : (e.clientX - i.left) / i.width, r = Math.min(1, Math.max(0, s));
    return this.targetTime + r * (this.clipEndTime - this.targetTime);
  }
  /** True while the host's slotted overlay timeline is on screen. */
  get _fsStrip() {
    return this._isFs && this.fsTimeline;
  }
  /** The fullscreen overlay timeline strip. Rendered as a SIBLING of the stage
   *  (inside the dialog on mobile) so it survives the stage being swapped for
   *  the scrub-preview one mid-drag — the drag that caused the swap.
   *  All pointer traffic stops here: the stage's tap-to-toggle would hide the
   *  controls mid-scrub, and the card's video-column drag gesture would read a
   *  vertical scrub as "open the camera strip". Down/move also re-arm the
   *  auto-hide so a long drag can't make the strip vanish under the finger. */
  _renderFsTimeline() {
    if (!this._fsStrip) return b;
    const e = (r) => {
      r.stopPropagation(), this._keepCtrlAlive();
    }, t = this.fsTimelineScrim, i = `linear-gradient(to left, rgba(0,0,0,${t}) 30%, rgba(0,0,0,${(t * 0.78).toFixed(3)}) 55%, rgba(0,0,0,${(t * 0.35).toFixed(3)}) 80%, transparent)`, s = this.fsTimelineGrabWidth > 0 ? `calc(${Math.max(this.fsTimelineWidth, this.fsTimelineGrabWidth)}px + ${this.fsTimelineGutter}px)` : "100%";
    return p`<div
      class="fs-tl ${this._followCtrl ? "show" : ""}"
      style="--upc-fs-tl-w:${this.fsTimelineWidth}px;--upc-fs-tl-boxw:${s};--upc-fs-tl-gut:${this.fsTimelineGutter}px;--upc-fs-tl-pad:${this.fsTimelinePadding}px;--upc-fs-tl-scrim-ext:${this.fsTimelineScrimExtend}px;--upc-fs-tl-bg:${i}"
      @pointerdown=${this._onStripPress}
      @pointermove=${e}
      @wheel=${e}
      @pointerup=${(r) => r.stopPropagation()}
      @pointercancel=${(r) => r.stopPropagation()}
      @click=${(r) => r.stopPropagation()}
    >
      <slot name="fs-timeline"></slot>
    </div>`;
  }
  render() {
    const e = this._stage(), t = p`<canvas class="freeze" ?hidden=${!this._frozen}></canvas>`;
    return this.stacked ? p`<dialog
      class="fs-wrap ${this._isFs ? "fs-active" : ""} ${this._forceRotate ? "rotate" : ""}"
      @close=${this._onDlgClose}
    >
      ${e}${t}${this._renderFsTimeline()}
    </dialog>` : p`${e}${t}${this._renderFsTimeline()}`;
  }
  _stage() {
    if (!this.nvrId || !this.cameraId)
      return p`<div class="stage"><div class="msg error">Missing camera / nvr_id.</div></div>`;
    const e = this.live && !this.scrubbing, t = e && !this.hass?.states[this.cameraId], i = !this.live && this._waiting && ei(this.gaps, this.targetTime), s = !this.live && !this.scrubbing && this._mode === null;
    return p`
      <div
        class="stage"
        style=${this.accent ? `--upc-accent:${this.accent}` : ""}
        @pointermove=${this.scrubbing ? void 0 : this._onStageHover}
      >
        <video class="main ${this._blank ? "blank" : ""}" playsinline preload="auto" muted></video>
        ${this.scrubbing ? p`
              <!-- SPRITE-PREVIEW-2026-08-04: the decoder-free surface. Always in
                   the tree while scrubbing so _drawSprite can paint it
                   synchronously, but only revealed once it holds a frame — until
                   then the paused footage underneath stays visible. -->
              <canvas class="sprite ${this._spriteReady ? "preview-on" : "preview-off"}"></canvas>
              <video
                class="preview-a ${this._previewActive === "a" ? "preview-on" : "preview-off"}"
                muted
                playsinline
                preload="auto"
                .src=${this._previewSrcA ?? ""}
                @loadedmetadata=${() => this._onPreviewMeta("a")}
                @loadeddata=${() => this._onPreviewLoaded("a")}
                @seeked=${() => this._onPreviewSeeked("a")}
                @error=${() => this._onPreviewError("a")}
              ></video>
              <video
                class="preview-b ${this._previewActive === "b" ? "preview-on" : "preview-off"}"
                muted
                playsinline
                preload="auto"
                .src=${this._previewSrcB ?? ""}
                @loadedmetadata=${() => this._onPreviewMeta("b")}
                @loadeddata=${() => this._onPreviewLoaded("b")}
                @seeked=${() => this._onPreviewSeeked("b")}
                @error=${() => this._onPreviewError("b")}
              ></video>
            ` : b}
        ${this.scrubbing ? b : this._tapToPlay ? p`<button class="tap-play" @click=${this._onTapToPlay} title="Play">▶</button>` : t ? p`<div class="msg error">Camera entity not found.</div>` : this._error ? p`<div class="msg error">${this._error}</div>` : i ? p`<div class="msg">Footage unavailable — camera was offline.</div>` : s ? p`<div class="msg">Tap the timeline to play from a time.</div>` : this._waiting && this._blank ? p`<div class="overlay"><div class="spinner"></div></div>` : this._waiting ? p`<div class="overlay buffering" aria-label="Loading footage">
                            <div class="spinner"></div>
                          </div>` : b}
        ${this.scrubbing ? this._renderCtrlBar(this._ctrlMode, !0) : this._renderCtrlBar(e ? "live" : "follow")}
      </div>
    `;
  }
};
f.styles = rt`
    :host {
      display: block;
      position: relative; /* the inline fs-wrap dialog fills the host */
      width: 100%;
      height: 100%;
    }
    /* The whole player lives inside an always-open <dialog> so mobile fullscreen
       can promote it to the TOP LAYER via showModal() — that escapes every
       ancestor's clipping/stacking (a plain position:fixed gets trapped in the
       card's nested layout) WITHOUT moving or remounting the <video>. Normally
       it's a layout-neutral, transparent, inline box filling the host. */
    .fs-wrap {
      display: block;
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      max-width: none;
      max-height: none;
      overflow: visible;
      color: inherit;
    }
    .fs-wrap:not([open]) {
      display: none;
    }
    /* Mobile fullscreen (showModal): fill the viewport. */
    .fs-wrap.fs-active {
      position: fixed;
      inset: 0;
      background: #000;
    }
    /* iOS can't lock orientation from JS, so rotate the player to landscape when
       the phone is portrait (turn the phone to watch). Flip 90deg->-90deg if it
       lands the wrong way. */
    .fs-wrap.fs-active.rotate {
      inset: auto;
      top: 50%;
      left: 50%;
      width: 100vh;
      height: 100vw;
      transform: translate(-50%, -50%) rotate(90deg);
      transform-origin: center center;
    }
    .fs-wrap::backdrop {
      background: #000;
    }
    /* The held frame: at the end of a scrub, a copy of the frame scrubbed TO,
       laid over the stage while the footage there loads, so the picture never
       jumps back to where playback was before the scrub. canvas is a replaced
       element, so object-fit letterboxes it exactly like the picture it was
       copied from. Above the players, below the chrome. */
    canvas.freeze {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
      z-index: 3;
      pointer-events: none;
    }
    .stage {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 200px;
      background: #000;
      border-radius: 10px;
      overflow: hidden;
    }
    /* TABLET/desktop element fullscreen: the VIDEO keeps its native positioning;
       only the CONTROLS are padded in from the screen edges. The gradient
       background (.vctrl) still spans full-width and reaches the bottom edge —
       just the buttons inside get the extra padding. */
    :host(:fullscreen) .vctrl {
      padding: 20px 48px 40px;
    }
    video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    /* THE player. Bottom of the stage; the scrub layer, the held frame and the
       chrome sit above it. No opacity transition: a fade is a black flash. */
    video.main {
      z-index: 0;
      transition: none;
    }
    /* A new selection waits for its own first frame (see _blank). */
    video.main.blank {
      opacity: 0;
    }
    /* Scrub-preview leap-frog videos — same deal: the standby one loads and
       seeks the next block/part underneath, then swaps in already decoded. */
    video.preview-a,
    video.preview-b {
      transition: none;
    }
    /* SPRITE-PREVIEW-2026-08-04: the sprite canvas shares the video geometry
       (absolute inset 0, object-fit: contain) so switching tiers cannot move or
       resize the picture. <canvas> is a replaced element, so object-fit applies
       to it exactly as it does to <video>. */
    canvas.sprite {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
      transition: none;
    }
    canvas.preview-off,
    video.preview-off {
      opacity: 0;
      z-index: 0;
    }
    canvas.preview-on,
    video.preview-on {
      opacity: 1;
      z-index: 1;
    }
    /* SPRITE-PREVIEW-2026-08-04: when the sprite canvas is live it owns the
       stage outright — the preview <video>s may still hold an older frame from
       a unit with no sheets, and it must not show through underneath. */
    canvas.sprite.preview-on {
      z-index: 2; /* above the preview <video>s (1), below the held frame (3) */
    }
    /* Shown when the browser refused to start playback (see _playFollowVideo).
       Sits above the video so the tap always reaches it. */
    .tap-play {
      position: absolute;
      z-index: 7; /* above the fullscreen timeline strip, which covers the stage */
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 64px;
      height: 64px;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      font-size: 26px;
      line-height: 1;
      padding-left: 4px; /* optically centre the ▶ glyph */
      cursor: pointer;
      appearance: none;
    }
    /* The scrub timestamp that used to sit on the stage is GONE. It was pinned
       to the bottom centre, which is exactly where the control bar lands on a
       phone and on a small tablet, so the one moment it mattered — mid-scrub,
       with the chrome up — was the one moment it was covered. The timeline's
       playhead pill carries the same clock and now swells while the ruler
       moves; see "PILL SWELL" in scrubber-timeline.ts. */
    /* Custom control bar for the delayed-follow stage — auto-hides. */
    .vctrl {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent);
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
      z-index: 4;
    }
    .vctrl.show {
      opacity: 1;
      pointer-events: auto;
    }
    /* Shown but not operable: the bar stays put while a scrub swaps the stage
       for the preview (no player to drive), so the chrome doesn't flicker away
       under the finger and back. */
    .vctrl.inert {
      pointer-events: none;
    }
    .vctrl-spacer {
      flex: 1 1 auto;
    }
    /* Fullscreen overlay timeline: a strip down the RIGHT edge holding the
       host's slotted scrubber, over the video. Appears and auto-hides with the
       control bar (same transition, same show class), so the player is never
       covered by chrome the user didn't ask for. */
    .fs-tl {
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      /* The padding is INSIDE the strip (border-box), so the scrim still runs to
         the screen edges while the ruler itself keeps its clearance from them.
         The box is as wide as the GRAB area; the ruler inside it draws
         right-anchored, and the scrim below is sized independently — so a wide
         gesture target costs nothing visually. */
      box-sizing: border-box;
      width: var(--upc-fs-tl-boxw, 100%);
      padding: var(--upc-fs-tl-pad, 100px) var(--upc-fs-tl-gut, 140px)
        var(--upc-fs-tl-pad, 100px) 0;
      z-index: 5; /* above .vctrl, whose gradient runs under the strip */
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
      /* A drag starting in the padding is handed to the timeline
         (_onStripPress); without this the browser claims the touch as a pan
         and cancels the pointer on its first move. */
      touch-action: none;
    }
    /* The dimming is a pseudo-element, not the strip's own background, so it can
       reach FURTHER LEFT than the strip's layout box — the event thumbnails hang
       outside the ruler, over the video, and need the same backing to stay
       readable. pointer-events:none keeps that overhang from swallowing taps
       meant for the video, and z-index:-1 puts it behind the ruler + thumbs.
       Built in the template from fs_timeline_scrim (no calc() inside a color
       function, which older WebViews drop). */
    .fs-tl::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      right: 0;
      /* Sized off the RULER, not the grab area: widening the touch target must
         not dim half the picture. */
      width: calc(
        var(--upc-fs-tl-w, 165px) + var(--upc-fs-tl-gut, 140px) +
          var(--upc-fs-tl-scrim-ext, 170px)
      );
      z-index: -1;
      pointer-events: none;
      background: var(--upc-fs-tl-bg, linear-gradient(to left, rgba(0, 0, 0, 0.88), transparent));
    }
    .fs-tl.show {
      opacity: 1;
      pointer-events: auto;
    }
    /* While the strip is up, keep every control clear of it: the bar's gradient
       still spans full width, only its contents move in. Both fullscreen
       flavors set their own padding SHORTHAND at a higher specificity (the
       element-fullscreen and rotated-mobile rules below), so the inset has to
       be spelled out against each of them or it is silently overridden. */
    .vctrl.fs-inset,
    :host(:fullscreen) .vctrl.fs-inset,
    :host([stacked]) .fs-wrap.fs-active .vctrl.fs-inset {
      padding-right: calc(var(--upc-fs-tl-w, 165px) + var(--upc-fs-tl-gut, 140px) + 12px);
      /* Above the strip: its grab area reaches well left of the ruler and would
         otherwise swallow the seek bar and the buttons under it. */
      z-index: 6;
      /* ...but only the CONTROLS need to win, not the bar's own box. The inset
         above leaves a wide empty lane on the right that lines up exactly with
         the strip, and the jump-to-live arrow sits low in it — on a phone the
         arrow's whole 38px band (timeline padding + 8px) falls inside the taller
         mobile bar, so an opaque .vctrl swallowed every tap on it and the arrow
         looked dead. (It worked on a tablet only because the bigger timeline
         padding happened to clear the shorter bar by 4px.) Hit-testing passes
         straight through the bar; its children opt back in below. */
      pointer-events: none;
    }
    /* Must follow .vctrl.show (same specificity, later wins) — and inert means
       shown-but-not-operable, so it keeps the whole bar dead. Clicks on the
       children still bubble to the bar's own stopPropagation sink. */
    .vctrl.fs-inset.show:not(.inert) > * {
      pointer-events: auto;
    }
    .vctrl button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 9px;
      background: rgba(0, 0, 0, 0.4);
      color: #fff;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .vctrl button:hover {
      background: rgba(0, 0, 0, 0.6);
    }
    .vctrl button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .vctrl button ha-icon {
      --mdc-icon-size: 24px;
    }
    /* FULLSCREEN: the bar has a whole screen to itself and is worked from
       across a room, where the inline player's 40px targets read as tiny next
       to the timeline. Scale the controls up and double the spacing between
       them. Inline players keep the compact sizing — a phone's card-sized bar
       has no room for this and would wrap. */
    .vctrl.fs {
      gap: 16px;
    }
    :host([stacked]) .vctrl.fs {
      gap: 12px;
    }
    .vctrl.fs button {
      width: 48px;
      height: 48px;
      border-radius: 11px;
    }
    .vctrl.fs button ha-icon {
      --mdc-icon-size: 29px;
    }
    .vctrl.fs .vctrl-speed {
      min-width: 53px;
      padding: 0 11px;
      font-size: 17px;
    }
    .vctrl.fs .vtime {
      font-size: 19px;
    }
    /* Speed toggle: a text pill; highlighted (accent) while >1×. */
    .vctrl-speed {
      width: auto;
      min-width: 44px;
      padding: 0 9px;
      font-size: 14px;
      font-weight: 700;
    }
    .vctrl-speed.on {
      background: var(--upc-accent, var(--primary-color, #03a9f4));
    }
    /* Clip time readout, YouTube-style "current / total" (M:SS). */
    .vtime {
      flex: 0 0 auto;
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      margin-left: 4px;
    }
    /* Wrapper around the time readout + seek bar. On tablet/desktop it is a
       no-op (display: contents) so both flow inline in the .vctrl row exactly as
       before; on phones it becomes the full-width seek ROW (see stacked rules). */
    .vseek-row {
      display: contents;
    }
    /* Clip seek bar: a track + fill + draggable playhead knob, filling the rest
       of the row after the buttons (the space the spacer holds otherwise). */
    .vseek {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      height: 40px;
      margin: 0 10px;
      cursor: pointer;
      touch-action: none;
    }
    .vseek-track {
      position: relative;
      width: 100%;
      height: 4px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.3);
    }
    .vseek-fill {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      border-radius: 3px;
      background: var(--upc-accent, var(--primary-color, #03a9f4));
    }
    .vseek-knob {
      position: absolute;
      top: 50%;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #fff;
      transform: translate(-50%, -50%);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    }
    /* Phone: the seek bar is crushed inline between the buttons on a narrow
       video, so give it its own FULL-WIDTH row ABOVE the button row (YouTube /
       Plex style). Tablet/desktop keep the single inline row (they have room). */
    :host([stacked]) .vctrl {
      flex-wrap: wrap;
      /* Roomier controls on phones: inset the buttons/seek from the edges. The
         gradient background still spans the whole bar (it's .vctrl's own
         background), so it stays anchored to the bottom edge. */
      padding: 12px 22px 22px;
      gap: 6px;
    }
    /* The seek row is the full first line ABOVE the buttons; inside it the time
       readout sits at the left and the seek bar fills the rest (YouTube style),
       so the bar stays wide/usable instead of being crushed inline. */
    :host([stacked]) .vseek-row {
      display: flex;
      align-items: center;
      flex: 1 0 100%;
      order: -1;
      margin: 0 2px 4px;
    }
    :host([stacked]) .vseek-row .vtime {
      margin: 0 8px 0 2px;
    }
    :host([stacked]) .vseek-row .vseek {
      flex: 1 1 auto;
      margin: 0;
    }
    /* Mobile LANDSCAPE fullscreen (the rotated top-layer dialog): the control
       bar runs along the physical screen edge and its ends land under the iOS
       status bar / home-indicator (notch side). Inset it a LOT more
       horizontally so no control sits under the status bar. The gradient still
       spans the whole bar (its own background) — only the buttons move in. */
    :host([stacked]) .fs-wrap.fs-active .vctrl {
      padding: 14px 76px 30px;
    }
    .overlay {
      position: absolute;
      inset: 0;
      z-index: 4; /* above the player and a held frame */
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 13px;
      text-align: center;
      padding: 12px;
      pointer-events: none;
    }
    /* Waiting with a picture on screen: transparent, and only after a grace
       period — a seek inside what is loaded lands well before it. */
    .buffering {
      background: transparent;
      opacity: 0;
      animation: upc-buffer-reveal 0s linear 1.2s forwards;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(255, 255, 255, 0.25);
      border-top-color: var(--upc-accent, var(--primary-color, #03a9f4));
      border-radius: 50%;
      animation: upc-spin 0.8s linear infinite;
    }
    .buffering .spinner {
      width: 40px;
      height: 40px;
      border-width: 4px;
      border-color: rgba(255, 255, 255, 0.28);
      border-top-color: var(--upc-accent, var(--primary-color, #03a9f4));
      border-right-color: var(--upc-accent, var(--primary-color, #03a9f4));
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
      animation-duration: 0.7s;
    }
    @keyframes upc-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @keyframes upc-buffer-reveal {
      to {
        opacity: 1;
      }
    }
    .msg {
      position: absolute;
      inset: 0;
      z-index: 4; /* above the player: an error must be seen */
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--secondary-text-color, #9aa0a6);
      font-size: 13px;
      text-align: center;
      padding: 12px;
    }
    .error {
      color: var(--error-color, #e53935);
    }
  `;
f._problemTimes = [];
f.TAP_SLOP_PX = 4;
f.TAP_MAX_MS = 600;
f.TAP_CLICK_WAIT_MS = 350;
g([
  c({ attribute: !1 })
], f.prototype, "hass", 2);
g([
  c()
], f.prototype, "nvrId", 2);
g([
  c()
], f.prototype, "cameraId", 2);
g([
  c({ attribute: !1 })
], f.prototype, "gaps", 2);
g([
  c({ type: Number })
], f.prototype, "targetTime", 2);
g([
  c({ type: Boolean })
], f.prototype, "scrubbing", 2);
g([
  c({ type: Boolean })
], f.prototype, "live", 2);
g([
  c({ type: Number })
], f.prototype, "now", 2);
g([
  c()
], f.prototype, "previewDir", 2);
g([
  c()
], f.prototype, "previewMode", 2);
g([
  c()
], f.prototype, "fastPreview", 2);
g([
  c({ type: Boolean })
], f.prototype, "tipEnabled", 2);
g([
  c({ type: Number })
], f.prototype, "clipEndTime", 2);
g([
  c()
], f.prototype, "accent", 2);
g([
  c()
], f.prototype, "liveAudioStart", 2);
g([
  c({ type: Boolean, reflect: !0 })
], f.prototype, "stacked", 2);
g([
  c({ type: Boolean })
], f.prototype, "startFs", 2);
g([
  c({ type: Boolean })
], f.prototype, "fsHandoff", 2);
g([
  c({ type: Boolean })
], f.prototype, "fsTimeline", 2);
g([
  c({ type: Number })
], f.prototype, "fsTimelineWidth", 2);
g([
  c({ type: Number })
], f.prototype, "fsTimelineGrabWidth", 2);
g([
  c({ type: Number })
], f.prototype, "fsTimelinePadding", 2);
g([
  c({ type: Number })
], f.prototype, "fsTimelineGutter", 2);
g([
  c({ type: Number })
], f.prototype, "fsTimelineScrim", 2);
g([
  c({ type: Number })
], f.prototype, "fsTimelineScrimExtend", 2);
g([
  m()
], f.prototype, "_error", 2);
g([
  G(".fs-wrap")
], f.prototype, "_fsDlg", 2);
g([
  G("video.main")
], f.prototype, "_mainVideo", 2);
g([
  G("video.preview-a")
], f.prototype, "_previewVidA", 2);
g([
  G("video.preview-b")
], f.prototype, "_previewVidB", 2);
g([
  m()
], f.prototype, "_mode", 2);
g([
  m()
], f.prototype, "_waiting", 2);
g([
  m()
], f.prototype, "_blank", 2);
g([
  m()
], f.prototype, "_followPaused", 2);
g([
  m()
], f.prototype, "_followMuted", 2);
g([
  m()
], f.prototype, "_tapToPlay", 2);
g([
  m()
], f.prototype, "_followCtrl", 2);
g([
  m()
], f.prototype, "_isFs", 2);
g([
  m()
], f.prototype, "_forceRotate", 2);
g([
  m()
], f.prototype, "_followRate", 2);
g([
  m()
], f.prototype, "_nearLive", 2);
g([
  m()
], f.prototype, "_livePausedState", 2);
g([
  m()
], f.prototype, "_liveMuted", 2);
g([
  m()
], f.prototype, "_seekDragAt", 2);
g([
  m()
], f.prototype, "_followNow", 2);
g([
  m()
], f.prototype, "_previewSrcA", 2);
g([
  m()
], f.prototype, "_previewSrcB", 2);
g([
  m()
], f.prototype, "_previewActive", 2);
g([
  G("canvas.sprite")
], f.prototype, "_spriteCanvas", 2);
g([
  m()
], f.prototype, "_spriteReady", 2);
g([
  m()
], f.prototype, "_hidden", 2);
g([
  m()
], f.prototype, "_suspended", 2);
g([
  m()
], f.prototype, "_frozen", 2);
g([
  G("canvas.freeze")
], f.prototype, "_freezeCanvas", 2);
f = g([
  ot("upc-media-view")
], f);
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const kt = te(class extends ee {
  constructor() {
    super(...arguments), this.key = b;
  }
  render(e, t) {
    return this.key = e, t;
  }
  update(e, [t, i]) {
    return t !== this.key && (Mt(e), this.key = t), i;
  }
});
function Pr(e, t, i) {
  return e.map((s) => ({ ...s, camera: t, cameraName: i }));
}
function Mr(e) {
  return e.flat().sort((t, i) => i.start - t.start);
}
function Ar(e, t) {
  const i = Math.max(0, Math.floor((t - e) / 1e3));
  if (i < 60) return "just now";
  const s = Math.floor(i / 60);
  if (s < 60) return s === 1 ? "1 minute ago" : `${s} minutes ago`;
  const r = Math.floor(s / 60);
  if (r < 24) return r === 1 ? "1 hour ago" : `${r} hours ago`;
  const o = Math.floor(r / 24);
  return o === 1 ? "1 day ago" : `${o} days ago`;
}
var Cr = Object.defineProperty, Fr = Object.getOwnPropertyDescriptor, F = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? Fr(t, i) : t, o = e.length - 1, n; o >= 0; o--)
    (n = e[o]) && (r = (s ? n(t, i, r) : n(r)) || r);
  return s && r && Cr(t, i, r), r;
};
let A = class extends j {
  constructor() {
    super(...arguments), this.bands = [], this.thumbVersion = 0, this.headerText = "Events", this.thumbSize = 0, this.timeSize = 12, this.playingKey = "", this.lastPlayedKey = "", this.keepLastPlayed = !1, this.expanded = !1, this.gridColumns = 2, this.accent = "#fc9df3", this.hideHead = !1, this.gridThumbWidth = 120, this.dateFontSize = 13, this.itemTextSize = 12, this.captions = !1, this.gridCaptions = !1, this._requested = /* @__PURE__ */ new Set(), this._bandByKey = /* @__PURE__ */ new Map(), this._toggle = async () => {
      if (this.expanded) {
        const e = this.renderRoot.querySelector(".gridlist");
        e && await e.animate(
          [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "translateY(-10px)" }
          ],
          { duration: 400, easing: "ease-in", fill: "forwards" }
        ).finished.catch(() => {
        });
      }
      this.dispatchEvent(new CustomEvent("toggle-expand", { bubbles: !0, composed: !0 }));
    };
  }
  connectedCallback() {
    super.connectedCallback(), this.hasUpdated && !this._io && this._setupObserver();
  }
  firstUpdated() {
    this._setupObserver();
  }
  _setupObserver() {
    this._io = new IntersectionObserver((e) => this._onIntersect(e), {
      root: this._stripEl ?? null,
      rootMargin: "300px 300px"
    }), this._observeThumbs();
  }
  updated(e) {
    e.has("expanded") && (this._io?.disconnect(), this._setupObserver(), this._prevExpanded !== void 0 && this._prevExpanded !== this.expanded && this.expanded && this.renderRoot.querySelector(".gridlist")?.animate(
      [
        { opacity: 0, transform: "translateY(-10px)" },
        { opacity: 1, transform: "none" }
      ],
      { duration: 400, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    ), this._prevExpanded = this.expanded), this._observeThumbs();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._io?.disconnect(), this._io = void 0;
  }
  /** A thumb scrolled into view -> request its thumbnail (once). */
  _onIntersect(e) {
    let t = !1;
    for (const i of e) {
      if (!i.isIntersecting) continue;
      const s = i.target.dataset.key;
      if (!s || this._requested.has(s)) continue;
      this._requested.add(s);
      const r = this._bandByKey.get(s);
      r && this.loader?.get(r), this._io?.unobserve(i.target), t = !0;
    }
    t && this.requestUpdate();
  }
  _observeThumbs() {
    this._io && this.renderRoot.querySelectorAll("[data-key]").forEach((e) => {
      const t = e.dataset.key;
      this._requested.has(t) || this._io.observe(e);
    });
  }
  // PERF-SCRUB-2026-08-03: memoised formatters — these run once per rendered
  // ROW, so a strip re-render used to build dozens. Revert: inline
  // `new Intl.DateTimeFormat(undefined, {...}).format(new Date(t))`.
  _fmtTime(e) {
    return ht(e, {
      hour: "numeric",
      minute: "2-digit"
    });
  }
  /* Day-divider helpers — same formats as the timeline view's events list. */
  _fmtDay(e) {
    return ht(e, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  }
  _sameDay(e, t) {
    const i = new Date(e), s = new Date(t);
    return i.getFullYear() === s.getFullYear() && i.getMonth() === s.getMonth() && i.getDate() === s.getDate();
  }
  /* Expanded-grid item texts: long time (matches the collapsed list) + duration. */
  _fmtTimeLong(e) {
    return ht(e, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
  _fmtDur(e) {
    const t = Math.max(1, Math.round(e / 1e3));
    if (t < 60) return `${t}s`;
    const i = Math.floor(t / 60), s = t % 60;
    return s ? `${i}m ${s}s` : `${i}m`;
  }
  _select(e) {
    this.dispatchEvent(
      new CustomEvent("strip-select", { detail: e, bubbles: !0, composed: !0 })
    );
  }
  /** Bring one clip into view — centred in whatever scrolls it (the grid, the
   *  tablet column, the phone carousel, or the page itself). Returns false when
   *  this strip does not hold that clip. */
  revealKey(e) {
    if (!e) return !1;
    const i = this.renderRoot.querySelector(`.thumb[data-key="${CSS.escape(e)}"]`)?.closest("button");
    return i ? (i.scrollIntoView({ block: "center", inline: "center" }), !0) : !1;
  }
  /** One event item — identical in both presentations (the expanded grid only
   *  changes the layout around it, never the item itself). */
  _renderClip(e, t, i) {
    const s = this.playingKey === t || (this.expanded || this.keepLastPlayed) && this.lastPlayedKey === t;
    return p`
      <button
        class="clip ${s ? "playing" : ""}"
        @click=${() => this._select(e)}
      >
        <div class="thumb" data-key=${t}>
          ${i ? p`<img src=${i} alt=${e.label} loading="lazy" />` : p`<span class="ph"></span>`}
          <!-- Caption mode moves the time to the line below (with the
               duration); the compact mode overlays it on the footage. -->
          ${this.captions ? b : p`<span class="time">${this._fmtTime(e.start)}</span>`}
        </div>
        <span class="cam">${e.cameraName}</span>
        ${this.captions ? p`<span class="sub"
              >${this._fmtTimeLong(e.start)} ·
              ${e.ongoing ? "In progress" : this._fmtDur(e.durMs ?? e.end - e.start)}</span
            >` : b}
      </button>
    `;
  }
  render() {
    this._bandByKey.clear();
    const e = this.thumbSize > 0 ? `${this.thumbSize}px` : "calc((100% - 12px) / 2)", t = se(
      this.bands,
      (i) => `${i.type}@${i.start}`,
      (i, s) => {
        const r = `${i.type}@${i.start}`;
        this._bandByKey.set(r, i);
        const o = this._requested.has(r) ? this.loader?.get(i) : void 0, n = this.expanded && (s === 0 || !this._sameDay(this.bands[s - 1].start, i.start));
        return p`
          ${n ? p`<div class="day-divider">
                <span class="day-label">${this._fmtDay(i.start)}</span>
              </div>` : b}
          ${this._renderClip(i, r, o)}
        `;
      }
    );
    return p`
      ${this.hideHead ? b : p`<div class="head">
            <span>${this.headerText}</span>
            <span class="head-count">${this.bands.length}</span>
            <button
              class="expand"
              title=${this.expanded ? "Show cameras" : "Browse all events"}
              @click=${this._toggle}
            >
              <!-- ONE static icon; :host([expanded]) rotates it 180° (swapping to
                   chevron-up here would cancel the rotation out = always-down). -->
              <ha-icon icon="mdi:chevron-down"></ha-icon>
            </button>
          </div>`}
      ${this.bands.length === 0 ? p`<div class="empty">No events</div>` : this.expanded ? p`<div
              class="gridlist"
              style="--upc-egrid-cols:${this.gridColumns};--upc-egrid-w:${this.gridThumbWidth}px;--upc-egrid-date:${this.dateFontSize}px;--upc-egrid-item:${this.itemTextSize}px;--upc-egrid-sub:${Math.max(1, this.itemTextSize - 1)}px;--upc-strip-time:${this.timeSize}px;--upc-strip-divider:${this.accent}"
            >
              ${t}
            </div>` : p`<div
              class="strip"
              style="--upc-strip-thumb:${e};--upc-strip-time:${this.timeSize}px;--upc-egrid-item:${this.itemTextSize}px;--upc-egrid-sub:${Math.max(
      1,
      this.itemTextSize - 1
    )}px"
            >
              ${t}
            </div>`}
      ${b}
    `;
  }
};
A.styles = rt`
    :host {
      display: block;
    }
    /* Header type matches the camera-name captions/overlays (14px/700). */
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 2px 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--secondary-text-color);
    }
    .head-count {
      color: var(--primary-text-color);
    }
    /* Carousel <-> grid-list toggle chevron, right after the count. The
       chevron ROTATES on toggle (one icon + transform) instead of swapping
       icons — the smooth turn is half the iOS feel. */
    .expand {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      color: var(--secondary-text-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .expand ha-icon {
      --mdc-icon-size: 22px;
      display: block;
      transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    :host([expanded]) .expand ha-icon {
      transform: rotate(180deg);
    }
    /* iOS-native carousel feel: the SCROLLER runs edge to edge (negative
       margins escape the ha-card's 12px side padding — matches the padding
       constant in card.ts styles) while a leading content inset keeps the
       first thumb 12px off the edge AT REST and scrolls away WITH the content.
       At rest the thumbs bleed under the right screen edge (shows there's
       more); fully scrolled, the last thumb settles 12px from the edge. */
    .strip {
      display: flex;
      gap: 12px; /* same as the edge insets — uniform rhythm, and it makes the
                    auto fit-2 layout symmetric (see thumbW derivation) */
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none; /* hide scrollbar, keep scrolling */
      -ms-overflow-style: none;
      margin: 0 -12px;
      padding: 0 12px 2px;
    }
    .strip::-webkit-scrollbar {
      display: none;
    }
    .empty {
      color: var(--secondary-text-color);
      font-size: 13px;
      padding: 8px 2px;
    }
    .clip {
      flex: 0 0 auto;
      position: relative;
      width: var(--upc-strip-thumb, 104px);
      box-sizing: border-box; /* the active card's padding insets inward */
      border: none;
      background: transparent;
      padding: 0;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .thumb {
      position: relative; /* anchors the .time overlay to the image */
      width: 100%;
      aspect-ratio: 16 / 10;
      border-radius: 8px;
      overflow: hidden;
      background: #000;
      border: 2px solid transparent;
      box-sizing: border-box;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    }
    .clip.playing .thumb {
      border-color: #fff;
    }
    .thumb img,
    .thumb .ph {
      width: 100%;
      height: 100%;
      display: block;
    }
    .thumb img {
      object-fit: cover;
    }
    .thumb .ph {
      background: var(--divider-color, rgba(255, 255, 255, 0.1));
    }
    /* Time overlay reads on any footage thanks to the text shadow (UniFi-style).
       Anchored to the IMAGE (.thumb is position:relative), not the whole clip
       button, so it stays on the footage above the caption. */
    .time {
      position: absolute;
      left: 7px;
      bottom: 6px;
      font-size: var(--upc-strip-time, 12px);
      font-weight: 600;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      pointer-events: none;
    }
    /* Camera name BELOW the thumbnail — same type as the live tiles' name
       overlay (14px/700 white, normal case), so the strip and the grid read
       as one family. */
    .cam {
      display: block;
      margin-top: 5px;
      font-size: 14px;
      font-weight: 700;
      text-align: left;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    /* ---- expanded grid list: the SAME items as the carousel, just laid out
       vertically — 2 columns match the carousel's fit-2 width, so the first
       row doesn't change size when toggling, only the orientation. ---- */
    :host([expanded]) {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    :host([expanded]) .head {
      flex: 0 0 auto;
    }
    .gridlist {
      display: grid;
      grid-template-columns: repeat(var(--upc-egrid-cols, 2), 1fr);
      gap: 12px;
      align-content: start;
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto; /* no-op when unconstrained (stacked: the page scrolls) */
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .gridlist::-webkit-scrollbar {
      display: none;
    }
    .gridlist .clip {
      width: 100%; /* the grid column defines the width */
      display: flex;
      flex-direction: column; /* thumb on top, camera (+ caption) below */
    }
    /* Tablet grid: FIXED-width cells (not 1fr) so the thumb width is exactly
       --upc-egrid-w — matching the collapsed list thumbnails — instead of
       stretching to fill (which ignored width changes). */
    :host([gridcaptions]) .gridlist {
      grid-template-columns: repeat(auto-fill, var(--upc-egrid-w, 132px));
      justify-content: start;
      gap: 14px 12px;
    }
    /* Caption mode item texts BELOW the thumb: camera on line 1, time +
       duration on line 2 — same size across tablet grid and mobile. */
    :host([captions]) .cam {
      font-size: var(--upc-egrid-item, 12px);
      font-weight: 600;
      margin-top: 4px;
    }
    .sub {
      display: block;
      margin-top: 1px;
      font-size: var(--upc-egrid-sub, 11px); /* 1px under the camera name */
      color: #d0d0d0; /* light inactive grey (lighter than theme secondary ~#b0) */
      text-align: left; /* align with the (left-aligned) camera name above */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    /* Caption mode: the PLAYING / last-played clip becomes a white FRAMED card
       (same look as the timeline camera gallery) — the thumbnail is inset by
       the clip's padding so the white mats it on ALL sides (not just a thin
       border), and the caption goes dark on the white. Applies to both the
       tablet grid and the mobile carousel/grid. */
    :host([captions]) .clip.playing {
      background: #fff;
      border-radius: 11px;
      padding: 5px;
    }
    :host([captions]) .clip.playing .thumb {
      border-color: transparent; /* the frame is the padding now, not a border */
      border-radius: 7px; /* concentric inside the 11px card */
      box-shadow: none;
    }
    :host([captions]) .clip.playing .cam {
      color: #000; /* line 1: black on the white card */
    }
    :host([captions]) .clip.playing .sub {
      color: #444; /* line 2: dark-ish grey (was light grey) */
    }
    /* Day separator between events from different days — same look as the
       timeline view's events list (accent rule, white centered date). */
    .day-divider {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px 2px;
    }
    .day-divider::before,
    .day-divider::after {
      content: '';
      flex: 1 1 auto;
      height: 1px;
      background: var(--upc-strip-divider, #fc9df3);
    }
    .day-label {
      flex: 0 0 auto;
      font-size: var(--upc-egrid-date, 13px);
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
    }
  `;
F([
  c({ attribute: !1 })
], A.prototype, "bands", 2);
F([
  c({ attribute: !1 })
], A.prototype, "loader", 2);
F([
  c({ type: Number })
], A.prototype, "thumbVersion", 2);
F([
  c()
], A.prototype, "headerText", 2);
F([
  c({ type: Number })
], A.prototype, "thumbSize", 2);
F([
  c({ type: Number })
], A.prototype, "timeSize", 2);
F([
  c()
], A.prototype, "playingKey", 2);
F([
  c()
], A.prototype, "lastPlayedKey", 2);
F([
  c({ type: Boolean })
], A.prototype, "keepLastPlayed", 2);
F([
  c({ type: Boolean, reflect: !0 })
], A.prototype, "expanded", 2);
F([
  c({ type: Number })
], A.prototype, "gridColumns", 2);
F([
  c()
], A.prototype, "accent", 2);
F([
  c({ type: Boolean })
], A.prototype, "hideHead", 2);
F([
  c({ type: Number })
], A.prototype, "gridThumbWidth", 2);
F([
  c({ type: Number })
], A.prototype, "dateFontSize", 2);
F([
  c({ type: Number })
], A.prototype, "itemTextSize", 2);
F([
  c({ type: Boolean, reflect: !0 })
], A.prototype, "captions", 2);
F([
  c({ type: Boolean, reflect: !0 })
], A.prototype, "gridCaptions", 2);
F([
  G(".strip")
], A.prototype, "_stripEl", 2);
A = F([
  ot("upc-event-strip")
], A);
var zr = Object.defineProperty, Rr = Object.getOwnPropertyDescriptor, I = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? Rr(t, i) : t, o = e.length - 1, n; o >= 0; o--)
    (n = e[o]) && (r = (s ? n(t, i, r) : n(r)) || r);
  return s && r && zr(t, i, r), r;
};
const Ne = 0;
let L = class extends j {
  constructor() {
    super(...arguments), this.entries = [], this.stacked = !1, this.newest = {}, this.minuteTick = 0, this.columns = 2, this.scrollMode = !1, this.aspect = "16/9", this.padTop = 0, this._streamReady = !1, this._visible = !0, this._boxW = 0, this._boxH = 0, this._fullscreen = (e, t) => {
      e.stopPropagation(), this.dispatchEvent(
        new CustomEvent("tile-fullscreen", { detail: t, bubbles: !0, composed: !0 })
      );
    };
  }
  connectedCallback() {
    if (super.connectedCallback(), customElements.get("ha-camera-stream"))
      this._streamReady = !0;
    else {
      const e = window.loadCardHelpers;
      e?.().then(() => {
        this._streamReady = !!customElements.get("ha-camera-stream");
      }), customElements.whenDefined("ha-camera-stream").then(() => {
        this._streamReady = !0;
      });
    }
    this._ro = new ResizeObserver((e) => {
      const t = e[e.length - 1].contentRect;
      t.width && t.height && (t.width !== this._boxW || t.height !== this._boxH) && (this._boxW = t.width, this._boxH = t.height);
    }), this._ro.observe(this), this._visibilityObserver = new IntersectionObserver((e) => {
      const t = e[e.length - 1].isIntersecting;
      t !== this._visible && (t || qt(this.renderRoot), this._visible = t);
    }), this._visibilityObserver.observe(this);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._ro?.disconnect(), this._visibilityObserver?.disconnect(), this._visibilityObserver = void 0, qt(this.renderRoot);
  }
  /** Aspect "16/9" -> 16/9 (safe fallback on garbage). */
  _ratio() {
    const [e, t] = this.aspect.split("/").map((i) => parseFloat(i));
    return e > 0 && t > 0 ? e / t : 16 / 9;
  }
  /** Tile width that fits `columns` per row AND all rows in the box height. */
  _tileWidth(e) {
    const t = Math.max(1, this.entries.length), i = Math.ceil(t / e), s = this._boxW || 320, r = this._boxH || 240, o = (s - (e - 1) * Ne) / e;
    if (this.scrollMode) return Math.max(80, o);
    const n = (r - this.padTop - (i - 1) * Ne) / i;
    return Math.max(80, Math.min(o, n * this._ratio()));
  }
  _open(e) {
    this.dispatchEvent(
      new CustomEvent("tile-open", { detail: e, bubbles: !0, composed: !0 })
    );
  }
  _renderTile(e) {
    const t = e.live_camera || e.camera, i = this.hass?.states[t], s = e.name || this.hass?.states[e.camera]?.attributes?.friendly_name || e.camera.split(".")[1] || e.camera, r = this.newest[e.camera];
    return p`
      <div class="tile" role="button" @click=${() => this._open(e)}>
        ${this._visible && this._streamReady && i ? p`<ha-camera-stream
              .hass=${this.hass}
              .stateObj=${i}
              .controls=${!1}
              .muted=${!0}
              allow-exoplayer
            ></ha-camera-stream>` : p`<div class="connecting">
              ${i ? "Connecting…" : `${t} not found`}
            </div>`}
        <span class="name">${s}</span>
        ${r ? p`<span class="last">${r.label}: ${Ar(r.start, Date.now())}</span>` : ""}
        <button class="fs-btn" title="Fullscreen" @click=${(o) => this._fullscreen(o, e)}>
          <ha-icon icon="mdi:fullscreen"></ha-icon>
        </button>
      </div>
    `;
  }
  render() {
    const e = this.stacked ? 1 : this.columns || Math.max(1, this.entries.length), t = this.stacked ? "100%" : `${this._tileWidth(e).toFixed(1)}px`, i = [];
    for (let r = 0; r < this.entries.length; r += e)
      i.push(this.entries.slice(r, r + e));
    const s = this.scrollMode ? 0 : this.padTop;
    return p`
      <div
        class="grid"
        style="--upc-tile-w:${t};--upc-grid-aspect:${this.aspect};--upc-pad-top:${s}px"
      >
        ${i.map((r) => p`<div class="row">${r.map((o) => this._renderTile(o))}</div>`)}
      </div>
    `;
  }
};
L.styles = rt`
    :host {
      display: block;
      height: 100%;
      overflow: hidden; /* wide: fit-to-box sizing — nothing to scroll */
    }
    /* Stacked (phone): full-width tiles at natural height — the PAGE
       (multi-view host) scrolls, not this element. */
    :host([stacked]) {
      height: auto;
      overflow: visible;
    }
    /* SCROLL mode (experimental 1-column tablet view): tiles fill the column
       width at their aspect and THIS element scrolls vertically instead of
       shrinking to fit — the hidden scrollbar keeps it clean. */
    :host([scrollmode]) {
      overflow-y: auto;
      scrollbar-width: none;
    }
    :host([scrollmode])::-webkit-scrollbar {
      display: none;
    }
    .grid {
      height: 100%;
      box-sizing: border-box; /* padding-top (below) counts inside the 100% */
      padding-top: var(--upc-pad-top, 0px); /* fit-mode top reserve (see padTop) */
      display: flex;
      flex-direction: column;
      justify-content: center; /* centers the rows vertically in the box */
      align-items: center;
      gap: 0; /* flush tiles — no spacing, like the UniFi app */
    }
    :host([stacked]) .grid,
    :host([scrollmode]) .grid {
      height: auto; /* content-sized — scrolls instead of fitting */
      justify-content: flex-start;
    }
    .row {
      display: flex;
      justify-content: center; /* centers an orphan tile on its row */
      gap: 0;
      width: 100%;
    }
    .tile {
      position: relative;
      flex: 0 0 auto;
      width: var(--upc-tile-w, 320px);
      aspect-ratio: var(--upc-grid-aspect, 16/9);
      border-radius: 0; /* flush, like the UniFi app */
      overflow: hidden;
      background: #000;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    :host([stacked]) .tile {
      border-radius: 10px; /* phone: full-width cards read better rounded */
    }
    /* --video-max-height: see the long note in media-view.ts. HA's players cap
       their inner <video> at calc(100vh - 97px) and let it sit at the top of the
       box, which pins the picture high and shrinks it whenever a tile is taller
       than that cap. Same override here so grid tiles letterbox like everything
       else. */
    ha-camera-stream {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      --video-max-height: 100%;
      pointer-events: none; /* controls are off; the tile itself is the tap target */
    }
    .connecting {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--secondary-text-color, #9aa0a6);
      font-size: 13px;
    }
    /* Dark-to-transparent scrim along the bottom so the name / motion overlays
       stay legible over light footage (text-shadow alone washes out). Sits above
       the video, below the text (z-index 2). */
    .tile::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 46px;
      background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent);
      pointer-events: none;
      z-index: 1;
    }
    /* Overlays read on any footage thanks to the scrim + text shadow. */
    .name {
      position: absolute;
      left: 12px;
      bottom: 9px;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      pointer-events: none;
      z-index: 2;
    }
    .last {
      position: absolute;
      right: 12px;
      bottom: 9px;
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      pointer-events: none;
      z-index: 2;
    }
    /* Phone (stacked): the tiles run full-width, so the overlays read a touch
       small — bump both up 1px. Tablet keeps 14/12. */
    :host([stacked]) .name {
      font-size: 15px;
    }
    :host([stacked]) .last {
      font-size: 13px;
    }
    /* Per-tile fullscreen button, top-right. Above the scrim/overlays; the
       stream has pointer-events:none and the tile opens on tap, so the button
       just stops propagation. */
    .fs-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 3;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.4);
      color: #fff;
      cursor: pointer;
      opacity: 0.85;
      -webkit-tap-highlight-color: transparent;
    }
    .fs-btn:hover {
      background: rgba(0, 0, 0, 0.6);
      opacity: 1;
    }
    .fs-btn ha-icon {
      --mdc-icon-size: 20px;
      display: block;
    }
    /* Phone: slightly larger tap target, matching the bumped overlays. */
    :host([stacked]) .fs-btn {
      top: 10px;
      right: 10px;
      width: 36px;
      height: 36px;
    }
    :host([stacked]) .fs-btn ha-icon {
      --mdc-icon-size: 22px;
    }
  `;
I([
  c({ attribute: !1 })
], L.prototype, "hass", 2);
I([
  c({ attribute: !1 })
], L.prototype, "entries", 2);
I([
  c({ type: Boolean, reflect: !0 })
], L.prototype, "stacked", 2);
I([
  c({ attribute: !1 })
], L.prototype, "newest", 2);
I([
  c({ type: Number })
], L.prototype, "minuteTick", 2);
I([
  c({ type: Number })
], L.prototype, "columns", 2);
I([
  c({ type: Boolean, reflect: !0, attribute: "scrollmode" })
], L.prototype, "scrollMode", 2);
I([
  c()
], L.prototype, "aspect", 2);
I([
  c({ type: Number })
], L.prototype, "padTop", 2);
I([
  m()
], L.prototype, "_streamReady", 2);
I([
  m()
], L.prototype, "_visible", 2);
I([
  m()
], L.prototype, "_boxW", 2);
I([
  m()
], L.prototype, "_boxH", 2);
L = I([
  ot("upc-live-grid")
], L);
var Lr = Object.defineProperty, Dr = Object.getOwnPropertyDescriptor, B = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? Dr(t, i) : t, o = e.length - 1, n; o >= 0; o--)
    (n = e[o]) && (r = (s ? n(t, i, r) : n(r)) || r);
  return s && r && Lr(t, i, r), r;
};
const Or = 3e4, Ir = 2 * 6e4, Br = 56, Nr = p`<svg viewBox="0 0 24 24">
  <rect x="4" y="5" width="16" height="5.5" rx="1.5"></rect>
  <rect x="4" y="13.5" width="16" height="5.5" rx="1.5"></rect>
</svg>`, Ur = p`<svg viewBox="0 0 24 24">
  <rect x="4" y="5" width="6.6" height="14" rx="1.5"></rect>
  <rect x="13.4" y="5" width="6.6" height="14" rx="1.5"></rect>
</svg>`;
let D = class extends j {
  constructor() {
    super(...arguments), this.stacked = !1, this._data = /* @__PURE__ */ new Map(), this._strip = [], this._expanded = !1, this._lastPlayedKey = "", this._minuteTick = 0, this._thumbVersion = 0, this._gridView = 2, this._loader = new si(2, () => {
      this._thumbVersion++;
    }), this._lastSyncTrigger = 0, this._fetchSeq = 0, this._suspendedForFs = !1, this._savedScroll = [], this._keepLastPlayed = !1, this._onStripSelect = (e) => {
      this._playBand(e.detail);
    }, this._onToggleExpand = async () => {
      if (this.stacked) {
        this._expanded = !this._expanded, this._expanded && this._closePlayback();
        return;
      }
      if (this._expanded) {
        const e = this.renderRoot.querySelector(".events-scroll.grid");
        e && await e.animate(
          [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "translateX(-30px)" }
          ],
          { duration: 240, easing: "ease-in", fill: "forwards" }
        ).finished.catch(() => {
        }), this._expanded = !1;
      } else
        this._closePlayback(), this._expanded = !0;
    }, this._closePlayback = () => {
      this._playback = void 0, this._eventSpan = void 0;
    }, this._onTileOpen = (e) => {
      const t = e.detail.navigation_path;
      if (t) {
        $t(t);
        return;
      }
      this.dispatchEvent(
        new CustomEvent("camera-open", { detail: e.detail.camera, bubbles: !0, composed: !0 })
      );
    }, this._onFsHandoff = (e) => {
      this._saveScroll(), this._suspendedForFs = !0, this._closePlayback(), this.dispatchEvent(
        new CustomEvent("camera-fullscreen-at", {
          detail: e.detail,
          bubbles: !0,
          composed: !0
        })
      );
    }, this._onTileFs = (e) => {
      this.dispatchEvent(
        new CustomEvent("camera-fullscreen", {
          detail: e.detail.camera,
          bubbles: !0,
          composed: !0
        })
      );
    };
  }
  connectedCallback() {
    super.connectedCallback(), this._refreshTimer = setInterval(() => void this._fetchAll(), Or), this._minuteTimer = setInterval(() => {
      this._minuteTick++;
    }, 6e4), this.hasUpdated && (this._suspendedForFs ? (this._suspendedForFs = !1, this._keepLastPlayed = !0, this._revealLastPlayed()) : this._resetToMain(), this._fetchAll());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), clearInterval(this._refreshTimer), clearInterval(this._minuteTimer), clearTimeout(this._syncRefetchTimer), this._loader.cancelAll(), this._suspendedForFs || this._resetToMain();
  }
  /** Remember every scrolled element in this page, and every scrolled
   *  ancestor (a popup or view that scrolls the page itself). Detaching the
   *  page — which the card does while the fullscreen timeline is up — resets
   *  scroll offsets, so "10 pages down, five days back" has to be put back by
   *  hand. The elements themselves survive (the card caches this page). */
  _saveScroll() {
    const e = [], t = (r) => {
      for (const o of Array.from(r.querySelectorAll("*")))
        (o.scrollTop || o.scrollLeft) && e.push([o, o.scrollTop, o.scrollLeft]), o.shadowRoot && t(o.shadowRoot);
    };
    t(this.renderRoot), (this.scrollTop || this.scrollLeft) && e.push([this, this.scrollTop, this.scrollLeft]);
    let i = this;
    for (; i; ) {
      const r = i.parentElement ?? (i.getRootNode().host || null);
      r instanceof Element && (r.scrollTop || r.scrollLeft) && e.push([r, r.scrollTop, r.scrollLeft]), i = r;
    }
    const s = document.scrollingElement;
    s && s.scrollTop && e.push([s, s.scrollTop, s.scrollLeft]), this._savedScroll = e;
  }
  _restoreScroll() {
    const e = this._savedScroll;
    this._savedScroll = [];
    for (const [t, i, s] of e)
      t.scrollTop = i, t.scrollLeft = s;
  }
  /** Back from the fullscreen timeline: put the page back where it was, then
   *  bring the clip that was playing into view and highlight it — in the grid,
   *  the tablet column, the phone carousel, whichever this page is showing.
   *  Restoring the old offsets alone is not enough: the strip had nothing to
   *  highlight and the exact item is what the viewer is looking for. */
  async _revealLastPlayed() {
    await this.updateComplete;
    const e = Array.from(this.renderRoot.querySelectorAll("upc-event-strip, upc-events-list"));
    await Promise.all(e.map((t) => t.updateComplete)), await new Promise((t) => requestAnimationFrame(t)), this._restoreScroll();
    for (const t of e)
      if (t.revealKey(this._lastPlayedKey)) break;
  }
  /** Return to the default main screen: no clip selected (live grid shown), not
   *  in the expanded events browser, default 2-column density, no last-played
   *  highlight. Used on every (re)entry so the view never resumes mid-clip. */
  _resetToMain() {
    this._closePlayback(), this._expanded = !1, this._lastPlayedKey = "", this._keepLastPlayed = !1, this._gridView = 2;
  }
  updated(e) {
    e.has("config") && this.config && (this._resetToMain(), this._fetchAll()), e.has("_expanded") && this._expanded && !this.stacked && this.renderRoot.querySelector(".events-scroll.grid")?.animate(
      [
        { opacity: 0, transform: "translateX(-30px)" },
        { opacity: 1, transform: "none" }
      ],
      { duration: 300, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    ), e.has("_expanded") && !this._expanded && e.get("_expanded") === !0 && !this.stacked && this.renderRoot.querySelector(".tablet .body")?.animate(
      [
        // The SLIDE finishes early (~offset 0.45 = ~315ms) so it stays snappy,
        // while the OPACITY keeps ramping over the full duration — a longer
        // fade masks more of the live-stream startup flash without the motion
        // feeling sluggish.
        { opacity: 0, transform: "translateX(24px)", offset: 0 },
        { transform: "none", offset: 0.45 },
        { opacity: 1, transform: "none", offset: 1 }
      ],
      { duration: 700, easing: "ease-out" }
    );
  }
  /** Normalized `cameras:` entries (strings become { camera }). */
  _entries() {
    return (this.config?.cameras ?? []).map((t) => typeof t == "string" ? { camera: t } : t).filter((t) => !!t?.camera);
  }
  /** Display name: config override -> friendly_name -> object_id. */
  _name(e) {
    if (e.name) return e.name;
    const t = this.hass?.states[e.camera]?.attributes?.friendly_name;
    return typeof t == "string" && t ? t : e.camera.split(".")[1] ?? e.camera;
  }
  _nvrIdFor(e) {
    return this.config?.nvr_id ? this.config.nvr_id : this.hass?.entities?.[e]?.config_entry_id ?? "";
  }
  /** Fan out one manifest load per camera (cheap static JSON), group each
   *  camera's events, rebuild the merged strip. Per-camera cache dirs are
   *  always derived from the entry's `camera` object_id — an explicit
   *  thumbnail_cache_dir can't apply to N cameras and is ignored here. */
  async _fetchAll() {
    const e = this._entries();
    if (!e.length) return;
    const t = ++this._fetchSeq, i = await Promise.all(
      e.map(async (n) => {
        const a = n.camera.split(".")[1];
        return { e: n, loaded: a ? await Je(`${ie}/${a}`) : void 0 };
      })
    );
    if (t !== this._fetchSeq) return;
    const s = (this.config?.event_merge_gap_seconds ?? 60) * 1e3, r = /* @__PURE__ */ new Map();
    let o = !1;
    for (const { e: n, loaded: a } of i)
      (!a || a.stale) && (o = !0), a && r.set(n.camera, {
        bands: Pr(ii(a.entries.map(Ze), s), n.camera, this._name(n)),
        preMs: a.preMs,
        postMs: a.postMs
      });
    this._data = r, this._strip = Mr([...r.values()].map((n) => n.bands)), this._thumbVersion++, o && this._requestSync();
  }
  /** Fire the pyscript sync service (throttled; it syncs ALL cameras) and
   *  re-check the manifests a few seconds later. No-ops without pyscript. */
  _requestSync() {
    if (!this.hass) return;
    const e = Date.now();
    e - this._lastSyncTrigger < Ir || (this._lastSyncTrigger = e, this.hass.callWS({ type: "call_service", domain: "pyscript", service: "protect_thumbs_sync" }).catch(() => {
    }), clearTimeout(this._syncRefetchTimer), this._syncRefetchTimer = setTimeout(() => void this._fetchAll(), 8e3));
  }
  _playBand(e) {
    this._playback = e, this._lastPlayedKey = `${e.type}@${e.start}`, this._keepLastPlayed = !1;
    const t = this._data.get(e.camera);
    this._eventSpan = {
      start: Math.max(e.start - (t?.preMs ?? 0), 0),
      end: Math.min(e.end + (t?.postMs ?? 0), Date.now())
    };
  }
  // Change the tablet live-grid density (1 = full-width scroll, 2 = columns).
  _setGridView(e) {
    this._gridView = e;
  }
  /** Segmented control that resizes the tablet live grid (1 or 2 columns). */
  _renderGridView(e) {
    const t = (i, s, r) => p`
      <button
        class=${e === i ? "on" : ""}
        title=${s}
        @click=${() => this._setGridView(i)}
      >
        ${r}
      </button>
    `;
    return p`<div class="grid-view">
      ${t(1, "Single column", Nr)} ${t(2, "Two columns", Ur)}
    </div>`;
  }
  render() {
    if (!this.hass || !this.config) return b;
    const e = this._entries(), t = e[0]?.camera ?? "";
    this._loader.configure(
      this.hass,
      this._nvrIdFor(t),
      t,
      this.config.thumbnail_concurrency ?? 2
    );
    const i = this.config.accent_color ?? "#fc9df3", s = this._playback, r = s ? `${s.type}@${s.start}` : "", o = s ? s.camera : "", n = s ? this._data.get(s.camera) : void 0, a = {};
    for (const h of e) a[h.camera] = this._data.get(h.camera)?.bands[0];
    return this.stacked ? p`
      <upc-event-strip
        captions
        .bands=${this._strip}
        .loader=${this._loader}
        .thumbVersion=${this._thumbVersion}
        .headerText=${this.config.strip_title ?? "Events"}
        .thumbSize=${this.config.mobile_events_thumbnail_size ?? 0}
        .timeSize=${this.config.strip_time_size ?? 12}
        .itemTextSize=${(this.config.list_text_size ?? 12) + 1}
        .playingKey=${r}
        .lastPlayedKey=${this._lastPlayedKey}
        .keepLastPlayed=${this._keepLastPlayed}
        .expanded=${this._expanded}
        .gridColumns=${2}
        .accent=${i}
        @strip-select=${this._onStripSelect}
        @toggle-expand=${this._onToggleExpand}
      ></upc-event-strip>
      ${this._expanded ? s ? p`<div class="playoverlay" @click=${this._closePlayback}>
              ${kt(
      o,
      p`<div class="playbox" @click=${(h) => h.stopPropagation()}>
                  ${this._renderPlayer(s, n, i)}
                  <span class="play-cam">${s.cameraName}</span>
                  <button class="live-pill" @click=${this._closePlayback}>✕</button>
                </div>`
    )}
            </div>` : b : p`<div class="body">
        ${s ? kt(
      o,
      p`<div class="playwrap">
                ${this._renderPlayer(s, n, i)}
                <span class="play-cam">${s.cameraName}</span>
                <button class="live-pill" @click=${this._closePlayback}>✕&nbsp;&nbsp;Live</button>
              </div>`
    ) : p`<upc-live-grid
              class=${this.stacked ? "bleed" : ""}
              .hass=${this.hass}
              .entries=${e}
              .stacked=${this.stacked}
              .newest=${a}
              .minuteTick=${this._minuteTick}
              .aspect=${this.config.grid_aspect ?? "16/9"}
              @tile-open=${this._onTileOpen}
              @tile-fullscreen=${this._onTileFs}
            ></upc-live-grid>`}
          </div>`}
    ` : this._renderTablet(e, i, s, r, o, n, a);
  }
  /** Tablet (wide) layout. Collapsed: the timeline-identical events LIST on the
   *  left (ALL cameras merged) + the live grid (or the clip player) on the right
   *  — click an event to play it on the right. Expanded (chevron): the events
   *  become a full-width grid to browse, cameras unmounted. */
  _renderTablet(e, t, i, s, r, o, n) {
    const a = this.config, h = a.tablet_events_thumbnail_size ?? 145, u = a.list_text_size ?? 12, d = Math.max(1, u - 1), l = this._gridView === 1 ? 1 : 2, _ = l, v = p`
      <div class="ev-head">
        <span>${a.strip_title ?? "Events"}</span>
        <span class="ev-count">${this._strip.length}</span>
        <button
          class="ev-chev"
          title=${this._expanded ? "Show cameras" : "Browse all events"}
          @click=${this._onToggleExpand}
        >
          <ha-icon icon="mdi:chevron-right"></ha-icon>
        </button>
      </div>
    `;
    return this._expanded ? p`
        <div class="tablet expanded">
          <div class="events-pane">
            ${v}
            <div class="events-scroll grid">
              <upc-event-strip
                expanded
                hideHead
                gridCaptions
                captions
                .bands=${this._strip}
                .loader=${this._loader}
                .thumbVersion=${this._thumbVersion}
                .timeSize=${a.strip_time_size ?? 12}
                .playingKey=${s}
                .lastPlayedKey=${this._lastPlayedKey}
                .keepLastPlayed=${this._keepLastPlayed}
                .expanded=${!0}
                .gridThumbWidth=${h}
                .dateFontSize=${a.date_font_size ?? 13}
                .itemTextSize=${u}
                .accent=${t}
                @strip-select=${this._onStripSelect}
              ></upc-event-strip>
            </div>
          </div>
          ${i ? p`<div class="playoverlay" @click=${this._closePlayback}>
                ${kt(
      r,
      p`<div class="playbox" @click=${(y) => y.stopPropagation()}>
                    ${this._renderPlayer(i, o, t)}
                    <span class="play-cam">${i.cameraName}</span>
                    <button class="live-pill" @click=${this._closePlayback}>✕</button>
                  </div>`
    )}
              </div>` : b}
        </div>
      ` : p`
      <div class="tablet">
        <div class="events-pane" style="flex-basis:${h + 168}px">
          ${v}
          <div class="events-scroll">
            <upc-events-list
              .bands=${this._strip}
              .loader=${this._loader}
              .thumbVersion=${this._thumbVersion}
              .textSize=${u}
              .textColor=${a.list_text_color ?? ""}
              .durationSize=${d}
              .durationColor=${a.list_duration_color ?? ""}
              .showCamera=${!0}
              .line1White=${!0}
              .activeTextSize=${a.list_active_text_size ?? 12}
              .activeTextColor=${a.list_active_text_color ?? "#000"}
              .activeDurationSize=${a.list_active_duration_size ?? 12}
              .activeDurationColor=${a.list_active_duration_color ?? "#000"}
              .activeBg=${a.list_active_bg ?? a.list_highlight_color ?? "#fff"}
              .playingKey=${s || (this._keepLastPlayed ? this._lastPlayedKey : "")}
              .dateFontSize=${a.date_font_size ?? 13}
              .dateFontColor=${a.date_font_color ?? "#ffffff"}
              .dividerColor=${t}
              .thumbWidth=${h}
              @event-selected=${this._onStripSelect}
            ></upc-events-list>
          </div>
        </div>
        <div class="body">
          ${i ? kt(
      r,
      p`<div class="playwrap">
                  ${this._renderPlayer(i, o, t)}
                  <span class="play-cam">${i.cameraName}</span>
                  <button class="live-pill" @click=${this._closePlayback}>✕&nbsp;&nbsp;Live</button>
                </div>`
    ) : p`<upc-live-grid
                  .hass=${this.hass}
                  .entries=${e}
                  .stacked=${!1}
                  .newest=${n}
                  .minuteTick=${this._minuteTick}
                  .columns=${l}
                  .scrollMode=${l === 1}
                  .padTop=${l === 1 ? 0 : Br}
                  .aspect=${this.config.grid_aspect ?? "16/9"}
                  @tile-open=${this._onTileOpen}
                  @tile-fullscreen=${this._onTileFs}
                ></upc-live-grid>
                ${this._renderGridView(_)}`}
        </div>
      </div>
    `;
  }
  /** The clip player, identical in both homes: the in-place .playwrap
   *  (collapsed page) and the .playbox lightbox over the expanded grid. */
  _renderPlayer(e, t, i) {
    const s = this._eventSpan ?? {
      start: Math.max(e.start - (t?.preMs ?? 0), 0),
      end: Math.min(e.end + (t?.postMs ?? 0), Date.now())
    };
    return p`<upc-media-view
      .hass=${this.hass}
      .nvrId=${this._nvrIdFor(e.camera)}
      .cameraId=${e.camera}
      .gaps=${[]}
      .targetTime=${s.start}
      .clipEndTime=${s.end}
      .scrubbing=${!1}
      .live=${!1}
      .stacked=${this.stacked}
      .previewDir=${""}
      .accent=${i}
      .now=${Date.now()}
      .fsHandoff=${!0}
      @fullscreen-handoff=${this._onFsHandoff}
    ></upc-media-view>`;
  }
};
D.styles = rt`
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px; /* clear separation between the event strip and the live grid */
      min-height: 0;
    }
    /* Stacked (phone): ONE page scroll — the strip and the camera tiles are
       normal flow content and scroll away together (hidden scrollbar). The
       host owns the 12px side padding (the card dropped its own — see
       ha-card.multi-stacked in card.ts): the -12px edge bleeds then land
       EXACTLY on the host edges, so nothing overflows horizontally and the
       page can never pan sideways (overflow-x hidden as the backstop). */
    :host([stacked]) {
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0 12px;
      box-sizing: border-box;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    :host([stacked])::-webkit-scrollbar {
      display: none;
    }
    upc-event-strip {
      flex: 0 0 auto;
    }
    /* Expanded events grid (wide layout): the strip becomes the flexing,
       internally-scrolling pane. Stacked keeps natural height (page scrolls). */
    upc-event-strip[expanded] {
      flex: 1 1 auto;
      min-height: 0;
    }
    :host([stacked]) upc-event-strip[expanded] {
      flex: 0 0 auto;
    }
    .body {
      flex: 1 1 auto;
      min-height: 0;
      position: relative;
    }
    :host([stacked]) .body {
      flex: 0 0 auto; /* natural height — part of the page scroll */
    }
    upc-live-grid,
    .playwrap {
      position: absolute;
      inset: 0;
    }
    /* Stacked: grid and player sit in normal flow at their natural height. */
    :host([stacked]) upc-live-grid {
      position: static;
      height: auto;
    }
    :host([stacked]) .playwrap {
      position: relative;
      inset: auto;
      aspect-ratio: 16 / 9; /* full-width player pane while a clip plays */
    }
    /* Stacked: the live tiles run EDGE TO EDGE — escape the ha-card's
       12px side padding (matches the padding constant in card.ts styles). */
    upc-live-grid.bleed {
      left: -12px;
      right: -12px;
    }
    :host([stacked]) upc-live-grid.bleed {
      left: auto;
      right: auto;
      margin: 0 -12px; /* static flow: escape the padding via margins */
    }
    upc-media-view {
      position: absolute;
      inset: 0;
    }
    /* Back-to-live pill over the playback surface (top-right, above the video
       but clear of its bottom controls). Matches the dark floating pills. */
    .live-pill {
      position: absolute;
      top: 10px;
      right: 10px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 16px;
      border: none;
      border-radius: 22px;
      cursor: pointer;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      z-index: 3;
      -webkit-tap-highlight-color: transparent;
    }
    /* Which camera's clip is playing (top-left, mirrors the tiles' name spot). */
    .play-cam {
      position: absolute;
      top: 14px;
      left: 12px;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
      pointer-events: none;
      z-index: 3;
    }
    /* Expanded-grid playback: a lightbox OVER the grid (the grid stays put).
       position:fixed resolves against the nearest transformed ancestor — the
       mobile view's fixed card / the bubble popup — so the scrim covers the
       card/popup; with no such ancestor it covers the viewport (also fine). */
    .playoverlay {
      position: fixed;
      inset: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(0, 0, 0, 0.6);
    }
    .playbox {
      position: relative;
      width: min(100%, 900px);
      aspect-ratio: 16 / 9;
    }
    /* Tablet: the lightbox scales with the space it has instead of stopping at
       900px — 90% of whichever side binds, kept 16:9, so a full-width popup gets
       a proportionally bigger player while a scrim margin (tap to close) stays.
       The overlay is the size container, so this tracks the popup, not the
       window. Phones keep the plain full-width rule above. */
    .tablet .playoverlay {
      container-type: size;
    }
    .tablet .playbox {
      width: min(90cqw, 90cqh * 16 / 9);
    }
    /* ---- Tablet (wide) layout: a UniFi-app split — events LIST on the left,
       live camera grid on the right. The chevron expands the events to a
       full-width grid (cameras hidden). Mobile/stacked keeps the top-strip
       layout above; this block only applies to the non-stacked render. ---- */
    .tablet {
      display: flex;
      flex-direction: row;
      gap: 16px;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
    }
    .events-pane {
      flex: 0 0 302px; /* fixed sidebar width; the grid takes the rest */
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .tablet.expanded .events-pane {
      flex: 1 1 auto; /* expanded: the events grid fills the whole page */
    }
    .ev-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 2px 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--secondary-text-color);
      flex: 0 0 auto;
    }
    .ev-count {
      color: var(--primary-text-color);
    }
    .ev-chev {
      /* Sits right after the "Events N" text (no margin-left:auto) so it stays
         with the title in BOTH the narrow list and the full-width grid. */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      padding: 4px;
      color: var(--secondary-text-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .ev-chev ha-icon {
      --mdc-icon-size: 22px;
      display: block;
      transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .tablet.expanded .ev-chev ha-icon {
      transform: rotate(180deg); /* chevron-right -> chevron-left (collapse) */
    }
    .events-scroll {
      position: relative; /* upc-events-list fills it via absolute inset:0 */
      flex: 1 1 auto;
      min-height: 0;
    }
    .events-scroll.grid {
      display: flex;
      flex-direction: column; /* the expanded event-strip fills the height */
    }
    .events-scroll.grid upc-event-strip {
      flex: 1 1 auto;
      min-height: 0;
    }
    /* Right pane: the live grid / clip player fills it (children are inset:0). */
    .tablet .body {
      flex: 1 1 auto;
      position: relative;
      min-height: 0;
    }
    /* Grid-density control — a segmented button floating over the top-RIGHT of
       the live grid (rows / 2-col). The active step reads white. Sits LEFT of
       the top tile's fullscreen button (which keeps the corner). */
    .grid-view {
      position: absolute;
      top: 8px;
      right: 48px;
      z-index: 4;
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: 11px;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
    }
    .grid-view button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 40px; /* portrait — a bit taller than wide */
      padding: 0;
      border: none;
      border-radius: 9px;
      background: transparent;
      color: rgba(255, 255, 255, 0.55);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition:
        color 0.15s,
        background 0.15s;
    }
    .grid-view button:hover {
      color: rgba(255, 255, 255, 0.85);
    }
    .grid-view button.on {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
    }
    .grid-view svg {
      width: 21px;
      height: 26px; /* portrait glyph to fill the taller button */
      fill: currentColor;
      display: block;
    }
  `;
B([
  c({ attribute: !1 })
], D.prototype, "hass", 2);
B([
  c({ attribute: !1 })
], D.prototype, "config", 2);
B([
  c({ type: Boolean, reflect: !0 })
], D.prototype, "stacked", 2);
B([
  m()
], D.prototype, "_data", 2);
B([
  m()
], D.prototype, "_strip", 2);
B([
  m()
], D.prototype, "_playback", 2);
B([
  m()
], D.prototype, "_expanded", 2);
B([
  m()
], D.prototype, "_lastPlayedKey", 2);
B([
  m()
], D.prototype, "_minuteTick", 2);
B([
  m()
], D.prototype, "_thumbVersion", 2);
B([
  m()
], D.prototype, "_gridView", 2);
B([
  m()
], D.prototype, "_keepLastPlayed", 2);
B([
  m()
], D.prototype, "_eventSpan", 2);
D = B([
  ot("upc-multi-view")
], D);
var Vr = Object.defineProperty, Hr = Object.getOwnPropertyDescriptor, T = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? Hr(t, i) : t, o = e.length - 1, n; o >= 0; o--)
    (n = e[o]) && (r = (s ? n(t, i, r) : n(r)) || r);
  return s && r && Vr(t, i, r), r;
};
const Wr = 3e4, jr = 2 * 6e4, qr = "3.0.0", Gr = 2e3, Yr = 1e3, Xr = 33, Kr = 1.3, Zr = 1.15;
let ut = 0, Ue = "", S = class extends j {
  constructor() {
    super(...arguments), this._gaps = [], this._targetTime = Date.now(), this._scrubbing = !1, this._liveMode = !0, this._livePaused = !1, this._now = Date.now(), this._nvrId = "", this._mode = "timeline", this._activeCamera = "", this._drillFs = !1, this._swapDir = 0, this._playerFs = !1, this._playerRotated = !1, this._galleryOpen = !1, this._calOpen = !1, this._calCursor = { y: 0, m: 0 }, this._hostWidth = 0, this._thumbVersion = 0, this._clipEnd = 0, this._manifestBands = [], this._preMs = 0, this._postMs = 0, this._lastSyncTrigger = 0, this._loader = new si(2, () => {
      this._thumbVersion++;
    }), this._inited = !1, this._goBack = () => {
      if (this._isMulti && this._drill) {
        this._drillOut();
        return;
      }
      const e = this._config?.back_button_path;
      if (e) {
        $t(e);
        return;
      }
      const t = this._config?.back_fallback_path || `/${window.location.pathname.split("/")[1] ?? ""}`;
      if (window.history.length <= 1) {
        $t(t);
        return;
      }
      const i = window.location.href;
      window.history.back(), window.setTimeout(() => {
        window.location.href === i && this.isConnected && $t(t);
      }, 400);
    }, this._onMediaFsExit = () => {
      this._drillFs && this._drillOut(!0);
    }, this._onPlayerFs = (e) => {
      this._playerFs = e.detail.fs, this._playerRotated = e.detail.rotated;
    }, this._pageBgApplied = !1, this._scrubPreviewScheduler = new ls(
      Xr,
      (e) => {
        this._targetTime = e;
      }
    ), this._onVideoPointerDown = (e) => {
      this._cameraEntries().length && (this._videoDrag = { x: e.clientX, y: e.clientY, id: e.pointerId, done: !1 });
    }, this._onVideoPointerMove = (e) => {
      const t = this._videoDrag;
      if (!t || t.done || e.pointerId !== t.id) return;
      const i = e.clientX - t.x, s = e.clientY - t.y;
      Math.abs(s) > 50 && Math.abs(s) > Math.abs(i) && (t.done = !0, this._galleryOpen = s > 0);
    }, this._onVideoPointerEnd = (e) => {
      this._videoDrag?.id === e.pointerId && (this._videoDrag = void 0);
    }, this._toggleGallery = () => {
      this._galleryOpen = !this._galleryOpen;
    }, this._toggleCal = () => {
      if (this._calOpen) {
        this._closeCal();
        return;
      }
      const e = new Date(this._domain ? P(this._domain, this._phFrac()) : Date.now());
      this._calCursor = { y: e.getFullYear(), m: e.getMonth() }, this._calOpen = !0, window.addEventListener("pointerdown", this._outsideCalClose, !0);
    }, this._outsideCalClose = (e) => {
      const t = e.composedPath(), i = this.renderRoot.querySelector(".cal-pop"), s = this.renderRoot.querySelector(".date-pill");
      i && t.includes(i) || s && t.includes(s) || (e.preventDefault(), e.stopPropagation(), ri(), this._closeCal());
    }, this._onLivePlaying = (e) => {
      this._livePaused = !e.detail.playing, e.detail.playing && this._liveMode && !this._scrubbing && this._domain && (this._now = Date.now(), this._domain = U(this._now, M(this._domain), this._phFrac()));
    }, this._modeSwapDir = 0, this._showTimeline = () => {
      this._setMode("timeline");
    }, this._showEvents = () => {
      this._setMode("list");
    }, this._onScrubStart = () => {
      this._cancelSettle(), this._scrubPreviewScheduler.reset(), this._scrubbing = !0;
    }, this._onScrubCancel = () => {
      this._cancelSettle(), this._scrubPreviewScheduler.reset(), this._scrubbing = !1;
    }, this._onScrub = (e) => {
      this._cancelSettle(), this._scrubbing = !0, this._liveMode = !1, this._playingBand = void 0, this._clearClip(), this._scrubPreviewScheduler.push(e.detail.time);
    }, this._onScrubEnd = (e) => {
      this._scrubPreviewScheduler.flush(e.detail.time), this._playingBand = void 0, this._cancelSettle();
      const t = () => {
        this._pendingScrubCommit = void 0, this._scrubbing = !1, this._clearClip(), this._livePaused = !1, this._liveMode = Date.now() - e.detail.time < 3e3;
      }, i = this._config?.scrub_settle_ms ?? 700;
      i <= 0 ? t() : (this._pendingScrubCommit = t, this._scrubSettleTimer = setTimeout(t, i));
    }, this._onDomainChange = (e) => {
      this._domain = e.detail, this._fetchGaps(!1);
    }, this._onLive = () => {
      if (!this._domain) return;
      this._scrubPreviewScheduler.reset(), this._cancelSettle(), this._now = Date.now();
      const e = this._domain, t = U(this._now, M(e), this._phFrac());
      this._domain = t, this._targetTime = this._now, this._glideRulers(e, t, Yr), this._scrubbing = !1, this._liveMode = !0, this._livePaused = !1, this._playingBand = void 0, this._clearClip();
    }, this._onRewind = (e) => {
      if (!this._domain) return;
      this._scrubPreviewScheduler.reset(), this._cancelSettle(), this._liveMode = !1, this._livePaused = !1, this._scrubbing = !1, this._playingBand = void 0, this._clearClip(), this._targetTime = e.detail.time;
      const t = this._domain, i = U(e.detail.time, M(t), this._phFrac());
      this._domain = i, this._glideRulers(t, i);
    }, this._onPlaybackTime = (e) => {
      if (this._liveMode || this._scrubbing || !this._domain) return;
      const t = this._domain, i = U(e.detail.time, M(t), this._phFrac());
      this._domain = i, Math.abs(
        P(i, this._phFrac()) - P(t, this._phFrac())
      ) >= Gr && this._glideRulers(t, i);
    }, this._onPlaybackSeek = (e) => {
      if (!this._domain) return;
      const t = this._domain, i = U(e.detail.time, M(t), this._phFrac());
      this._domain = i, this._glideRulers(t, i);
    }, this._onEventSelected = (e) => {
      this._playBand(e.detail);
    };
  }
  /** Events both views render: the manifest's raw NVR events, gap-merged into
   *  UniFi-style display groups (see _fetchManifest / data/event-groups.ts). */
  get _viewBands() {
    return this._manifestBands;
  }
  setConfig(e) {
    if (e.card_version === "multi") {
      const t = (e.cameras ?? []).map((i) => typeof i == "string" ? i : i?.camera).find((i) => !!i);
      if (!t)
        throw new Error(
          'unifi-protect-timeline-card: card_version: multi requires a non-empty "cameras" list'
        );
      e = e.camera ? e : { ...e, camera: t };
    } else if (!e.camera)
      throw new Error('unifi-protect-timeline-card: "camera" (a camera entity_id) is required');
    this._config = e, this._activeCamera = e.camera, this._drill = void 0, this._galleryOpen = !1, this._closeCal(), this._inited = !1;
  }
  get _isMulti() {
    return this._config?.card_version === "multi";
  }
  getCardSize() {
    return 6;
  }
  /** Multi page → full single-camera timeline, in-card (slide in from the
   *  right). Same per-camera reset as _selectCamera + the single-mode init
   *  that _init() skips for multi. */
  /** `at`: open at that moment and play on from it instead of opening live —
   *  the multi page's clip player hands off here when its fullscreen button is
   *  pressed, so the fullscreen timeline continues the clip where it was. */
  _drillTo(e, t = !1, i) {
    this._drill = e, this._drillFs = t, this._activeCamera = e, this._nvrId = this._resolveNvrId(), this._loader.cancelAll(), this._manifestBands = [], this._gaps = [], this._gapRange = void 0, this._preMs = 0, this._postMs = 0, this._lastSyncTrigger = 0, this._resetToLive(), i !== void 0 && this._domain && i < Date.now() - 3e3 && (this._liveMode = !1, this._targetTime = i, this._domain = U(i, M(this._domain), this._phFrac())), this._fetchGaps(!0), this._fetchManifest(), this._swapDir = t ? 0 : 1;
  }
  /** Drilled timeline → back to the multi page (slide in from the left). */
  _drillOut(e = !1) {
    this._drill = void 0, this._drillFs = !1, this._activeCamera = this._config?.camera ?? "", this._loader.cancelAll(), this._swapDir = e ? 0 : -1;
  }
  /** Where the playhead sits down the strip. Lower in a phone's fullscreen
   *  overlay so the active event's thumbnail clears the top fade (see
   *  PHONE_FS_PLAYHEAD_FRAC). ONE value for the card's domain math and for both
   *  timelines — they must agree, or the marker and the footage drift apart.
   *  The card column's timeline follows the overlay while it is up; it is
   *  behind the fullscreen player, so nobody sees it move. */
  _phFrac() {
    return this._playerFs && this._isStacked() ? qi : zt;
  }
  /** Clearance the fullscreen ruler keeps from the top/bottom screen edges.
   *  Per layout — see the block in render(), its only caller. */
  _fsPad() {
    return this._config?.fs_timeline_padding ?? (this._isStacked() ? 20 : 60);
  }
  /** The lane between the ruler and the right screen edge — it has to fit the
   *  zoom control and the jump-to-live arrow with room to breathe. On a phone
   *  that edge is also iOS's system-gesture strip: a button sitting in it never
   *  receives the touch at all, so the lane is wide enough to keep the whole
   *  control column clear of it. */
  _fsGutter() {
    return this._config?.fs_timeline_gutter ?? (this._isStacked() ? 110 : 140);
  }
  static getStubConfig() {
    return {
      type: "custom:unifi-protect-timeline-card",
      card_version: "single",
      camera: "camera.front_door",
      cameras: [],
      strip_title: "Events",
      mobile_events_thumbnail_size: 0,
      tablet_events_thumbnail_size: 145,
      strip_time_size: 12,
      grid_aspect: "16/9",
      page_background: "",
      calendar_days: 30,
      nvr_id: "",
      layout: "auto",
      layout_breakpoint: 600,
      video_ratio: 0.45,
      video_aspect: "",
      height: "",
      back_button: !1,
      back_button_size: 38,
      back_button_path: "",
      back_fallback_path: "",
      title: "UniFi Protect Timeline",
      title_font_size: 24,
      title_font_color: "",
      title_font_weight: 500,
      default_timeline_zoom: 100,
      live_audio_start: "muted",
      scrub_settle_ms: 700,
      timeline_font_size: 12,
      timeline_font_color: "#d0d0d0",
      date_font_size: 13,
      date_font_color: "#ffffff",
      accent_color: "#fc9df3",
      toggle_bg: "",
      toggle_active_bg: "",
      toggle_active_color: "",
      toggle_text_color: "",
      list_divider_color: "",
      arrow_color: "rgba(0,0,0,0.6)",
      live_arrow_bottom: 14,
      tick_color: "#4f4f4f",
      tick_size: 8,
      recorded_color: "#6e476a",
      future_color: "#7a7a84",
      show_footage_gaps: !0,
      gap_color: "#4a4a52",
      thumb_size: 87,
      thumb_size_active: 105,
      event_merge_gap_seconds: 60,
      list_text_size: 12,
      list_text_color: "",
      list_duration_color: "",
      list_active_text_size: 12,
      list_active_text_color: "#000",
      list_active_duration_size: 12,
      list_active_duration_color: "#000",
      list_active_bg: "#fff",
      thumbnail_concurrency: 2,
      thumbnail_cache_dir: "",
      scrub_preview: !0,
      scrub_preview_dir: "",
      scrub_fast_preview: "speed",
      fs_timeline: !0,
      fs_timeline_width: 165,
      fs_timeline_grab_width: 0,
      fs_timeline_padding: 60,
      fs_timeline_gutter: 140,
      fs_timeline_scrim: 0.88,
      fs_timeline_scrim_extend: 170
    };
  }
  /** page_background: pin the page canvas (<html>) to the configured color for
   *  this card's lifetime. The canvas is what shows through while HA's
   *  view-transition helpers fade the view container (the view's own
   *  background fades WITH the container) — on themes whose canvas is lighter
   *  than the card views, that reads as a flicker between two dark views. */
  _applyPageBackground() {
    const e = this._config?.page_background;
    if (!e) return;
    const t = document.documentElement;
    ut === 0 && (Ue = t.style.backgroundColor), ut++, t.style.backgroundColor = e, this._pageBgApplied = !0;
  }
  _removePageBackground() {
    this._pageBgApplied && (this._pageBgApplied = !1, ut--, ut <= 0 && (ut = 0, document.documentElement.style.backgroundColor = Ue));
  }
  connectedCallback() {
    super.connectedCallback(), this._applyPageBackground(), this._tick = setInterval(() => this._onTick(), 1e3), this._bandInterval = setInterval(() => {
      this._isMulti && !this._drill || (this._fetchGaps(!0), this._fetchManifest());
    }, Wr), this._hostRo = new ResizeObserver((e) => {
      const t = Math.round(e[e.length - 1].contentRect.width);
      t && t !== this._hostWidth && (this._hostWidth = t);
    }), this._hostRo.observe(this), this.hasUpdated && this._config && !this._isMulti && (this._resetToLive(), this._fetchGaps(!0), this._fetchManifest());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._removePageBackground(), clearInterval(this._tick), clearInterval(this._bandInterval), clearTimeout(this._syncRefetchTimer), clearTimeout(this._scrubSettleTimer);
    const e = this._pendingScrubCommit;
    this._pendingScrubCommit = void 0, e?.(), this._scrubPreviewScheduler.reset(), this._hostRo?.disconnect(), window.removeEventListener("pointerdown", this._outsideCalClose, !0), this._loader.cancelAll();
  }
  updated(e) {
    if ((e.has("hass") || e.has("_config")) && this.hass && this._config && !this._inited && this._init(), this._swapDir) {
      const t = this._swapDir;
      this._swapDir = 0, this.renderRoot.querySelector("ha-card")?.animate(
        [{ transform: `translateX(${t * 100}%)` }, { transform: "translateX(0)" }],
        { duration: 450, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
    }
    if (e.has("_mode") && this._modeSwapDir) {
      const t = this._modeSwapDir;
      this._modeSwapDir = 0;
      const i = this.renderRoot.querySelector(".mode-body");
      i && (i.getAnimations().forEach((s) => s.cancel()), i.animate(
        [
          { opacity: 0, transform: `translateX(${t * 18}px)` },
          { opacity: 1, transform: "none" }
        ],
        { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      ));
    }
  }
  _init() {
    this._inited = !0, !this._isMulti && (this._nvrId = this._resolveNvrId(), this._resetToLive(), this._fetchGaps(!0), this._fetchManifest());
  }
  /** Reset the single-camera timeline to a fresh LIVE session — forget the
   *  previous mode / played clip / scrub position so the view ALWAYS opens on
   *  live no matter how it was entered (first mount, in-card drill from the
   *  multi page, or a cached subview re-shown). Camera data re-fetches. */
  _resetToLive() {
    this._mode = "timeline", this._galleryOpen = !1, this._calOpen = !1, this._now = Date.now(), this._domain = U(this._now, this._initialSpan(), this._phFrac()), this._targetTime = this._now, this._scrubbing = !1, this._liveMode = !0, this._livePaused = !1, this._playingBand = void 0, this._clearClip();
  }
  /** Server-side cache dir: explicit config, else /protect_thumbs/<cam id>.
   *  The explicit dir only applies to the CONFIG camera — when the gallery strip
   *  switched to another camera, its cache dir must be derived from that
   *  camera's object_id or every camera would share one manifest. */
  _cacheDir() {
    if (this._config?.thumbnail_cache_dir && this._activeCamera === this._config.camera)
      return this._config.thumbnail_cache_dir;
    const e = this._activeCamera?.split(".")[1];
    return e ? `${ie}/${e}` : "";
  }
  /** Scrub-preview cache dir (pyscript protect_scrub job): explicit config for
   *  the CONFIG camera, else /protect_scrub/<object_id> — same per-camera
   *  derivation as _cacheDir. Empty string = preview disabled. */
  _scrubDir() {
    if (this._config?.scrub_preview === !1) return "";
    if (this._config?.scrub_preview_dir && this._activeCamera === this._config.camera)
      return this._config.scrub_preview_dir;
    const e = this._activeCamera?.split(".")[1];
    return e ? `${Bi}/${e}` : "";
  }
  /** Load the event manifest (the NVR's own event list, mirrored by the pyscript
   *  sync job). Cheap static file. If it's missing or stale (job not running /
   *  not run yet), ask the sync service to run now — that's the "event exists on
   *  the NVR but isn't cached yet" retrieval path. */
  async _fetchManifest() {
    const e = this._cacheDir();
    if (!e) return;
    const t = this._activeCamera, i = await Je(e);
    if (t === this._activeCamera) {
      if (i) {
        this._preMs = i.preMs, this._postMs = i.postMs;
        const s = (this._config?.event_merge_gap_seconds ?? 60) * 1e3;
        this._manifestBands = ii(i.entries.map(Ze), s), this._thumbVersion++;
      }
      (!i || i.stale) && this._requestSync();
    }
  }
  /** Fire the pyscript sync service (throttled) and re-check the manifest a few
   *  seconds later. No-ops silently when pyscript isn't installed. */
  _requestSync() {
    if (!this.hass) return;
    const e = Date.now();
    e - this._lastSyncTrigger < jr || (this._lastSyncTrigger = e, this.hass.callWS({ type: "call_service", domain: "pyscript", service: "protect_thumbs_sync" }).catch(() => {
    }), clearTimeout(this._syncRefetchTimer), this._syncRefetchTimer = setTimeout(() => void this._fetchManifest(), 8e3));
  }
  /** Initial visible span: default_timeline_zoom (0–100) wins, else minutes. */
  _initialSpan() {
    const e = this._config?.default_timeline_zoom;
    if (e != null) {
      const t = Math.max(0, Math.min(100, e)), i = Math.round((1 - t / 100) * (V.length - 1));
      return V[i];
    }
    return this._config?.default_span_minutes != null ? Gi(this._config.default_span_minutes * st) : V[0];
  }
  _resolveNvrId() {
    return this._config?.nvr_id ? this._config.nvr_id : this.hass?.entities?.[this._activeCamera || this._config.camera]?.config_entry_id ?? "";
  }
  // ---- camera gallery strip ------------------------------------------------
  /** Normalized `cameras:` entries (strings become { camera }). Empty when the
   *  option is absent -> single-camera card, no strip, no drag gesture. */
  _cameraEntries() {
    return (this._config?.cameras ?? []).map((t) => typeof t == "string" ? { camera: t } : t).filter((t) => !!t?.camera);
  }
  /** Display name for a camera: config override -> friendly_name -> object_id. */
  _cameraName(e) {
    const t = this._cameraEntries().find((s) => s.camera === e);
    if (t?.name) return t.name;
    const i = this.hass?.states[e]?.attributes?.friendly_name;
    return typeof i == "string" && i ? i : e.split(".")[1] ?? e;
  }
  /** Switch the whole card to another camera (gallery tap). Clears every
   *  per-camera slice of state, jumps to live, and refetches gaps + manifest
   *  (the cache dir follows the camera). Deliberately does NOT close the strip
   *  — only dragging UP on the video does. */
  _selectCamera(e) {
    e !== this._activeCamera && (this._activeCamera = e, this._nvrId = this._resolveNvrId(), this._loader.cancelAll(), this._manifestBands = [], this._gaps = [], this._gapRange = void 0, this._preMs = 0, this._postMs = 0, this._lastSyncTrigger = 0, this._liveMode || !this._domain ? this._onLive() : (this._cancelSettle(), this._playingBand = void 0, this._clearClip(), this._livePaused = !1, this._scrubbing = !1, this._targetTime = Math.min(P(this._domain, this._phFrac()), Date.now())), this._fetchGaps(!0), this._fetchManifest());
  }
  _closeCal() {
    this._calOpen = !1, window.removeEventListener("pointerdown", this._outsideCalClose, !0);
  }
  _calShift(e) {
    const t = new Date(this._calCursor.y, this._calCursor.m + e, 1);
    this._calCursor = { y: t.getFullYear(), m: t.getMonth() };
  }
  /** Calendar day tap.
   *  Timeline view: jump the playhead to NOON of that day (today's noon may
   *  still be in the future -> just go live instead), reusing the scrub-end
   *  state transitions so playback starts exactly like a manual seek.
   *  Events view: scroll the LIST to that day's section and play the day's
   *  latest event (today = scroll to top + live) — never a bare noon seek. */
  _selectCalDay(e, t, i) {
    if (this._closeCal(), !this._domain) return;
    this._cancelSettle();
    const s = new Date(e, t, i, 0, 0, 0, 0).getTime();
    if (this._mode === "list") {
      this.renderRoot.querySelector("upc-events-list")?.scrollToDay(s);
      const n = s + 864e5;
      if (n > Date.now()) {
        this._onLive();
        return;
      }
      let a;
      for (const h of this._viewBands)
        h.start >= s && h.start < n && (!a || h.start > a.start) && (a = h);
      a && this._playBand(a);
      return;
    }
    const r = new Date(e, t, i, 12, 0, 0, 0).getTime();
    if (r >= Date.now() - 2e4) {
      this._onLive();
      return;
    }
    this._playingBand = void 0, this._clearClip(), this._scrubbing = !1, this._livePaused = !1, this._liveMode = !1, this._targetTime = r, this._domain = U(r, M(this._domain), this._phFrac()), this._fetchGaps(!1);
  }
  // ---- live tick & band fetching -----------------------------------------
  _onTick() {
    this._now = Date.now(), this._liveMode && !this._scrubbing && !this._livePaused && this._domain && (this._domain = U(this._now, M(this._domain), this._phFrac()));
  }
  /** Fetch camera-offline (footage-gap) spans for a large buffer around the
   *  visible window, guard-gated so panning inside the buffer is free. This is
   *  a cheap HA history query, NOT an NVR call. (Events themselves come from
   *  the manifest — see _fetchManifest.) */
  async _fetchGaps(e = !1) {
    if (!this.hass || !this._domain || !(this._config?.show_footage_gaps ?? !0)) return;
    const t = M(this._domain), i = Math.max(t * 2, 180 * st), s = this._domain.start - i, r = Math.min(this._domain.end + i, this._now + 1e3), o = i * 0.5, n = !!this._gapRange && this._domain.start - o >= this._gapRange.start && this._domain.end + o <= this._gapRange.end;
    if (!e && n) return;
    this._gapRange = { start: s, end: r };
    const a = this._activeCamera || this._config.camera, h = await os(this.hass, a, s, r, this._nvrId);
    a === this._activeCamera && (this._gaps = h);
  }
  // 1 = switching to Events, -1 = to Timeline
  async _setMode(e) {
    if (this._mode === e) return;
    const t = e === "list", i = this.renderRoot.querySelector(".mode-body");
    i && await i.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: `translateX(${(t ? -1 : 1) * 18}px)` }
      ],
      { duration: 140, easing: "ease-in", fill: "forwards" }
    ).finished.catch(() => {
    }), this._modeSwapDir = t ? 1 : -1, this._mode = e;
  }
  /** Supersede a pending settle (a newer action decides the state instead). */
  _cancelSettle() {
    clearTimeout(this._scrubSettleTimer), this._pendingScrubCommit = void 0;
  }
  _glideRulers(e, t, i) {
    for (const s of this._timelines) s.glideDomain(e, t, i);
  }
  /** Play one event's clip, padded with the camera's recording pre/post roll
   *  (from the manifest) so the player covers what the UniFi app plays. The
   *  listed duration stays the raw event duration (end - start).
   *  Reached from the EVENTS view only (a row tap, the autoplay chain, the
   *  calendar's day pick): a bounded clip is that view's playback mode. The
   *  timeline never gets here — tapping a thumbnail there seeks the ruler and
   *  keeps playing the continuous footage. */
  _playBand(e) {
    this._domain && (this._scrubPreviewScheduler.reset(), this._cancelSettle(), this._scrubbing = !1, this._liveMode = !1, this._playingBand = e, this._clipEnd = Math.min(e.end + this._postMs, Date.now()), this._targetTime = Math.max(e.start - this._preMs, 0), this._domain = U(e.start, M(this._domain), this._phFrac()));
  }
  /** Leave event playback: no event end (the media view plays on regardless). */
  _clearClip() {
    this._clipEnd = 0;
  }
  /** The multi-camera page (card_version: multi): same ha-card + header shell
   *  (title, optional back button) as the single card, with <upc-multi-view>
   *  (event strip + live grid / clip playback) filling the rest. */
  _renderMulti() {
    const e = this._config, t = this._isStacked(), i = e.height || (t ? "100dvh" : "80vh"), s = (e.title_font_weight ? `--upc-title-weight:${e.title_font_weight};` : "") + (e.title_font_size ? `--upc-title-size:${e.title_font_size}px;` : "") + (e.title_font_color ? `--upc-title-color:${e.title_font_color};` : "");
    return p`
      <ha-card class=${t ? "multi-stacked" : ""} style=${`height:${i}`}>
        <div class="header" style=${s}>
          ${e.back_button ? p`<button
                class="back-btn"
                aria-label="Back"
                style=${`--upc-back-size:${e.back_button_size ?? 38}px`}
                @click=${this._goBack}
              >
                <ha-icon icon="mdi:chevron-left"></ha-icon>
              </button>` : b}
          <span class="title-text">${e.title ?? "Cameras"}</span>
        </div>
        <upc-multi-view
          .hass=${this.hass}
          .config=${e}
          .stacked=${t}
          @camera-open=${(r) => this._drillTo(r.detail)}
          @camera-fullscreen=${(r) => this._drillTo(r.detail, !0)}
          @camera-fullscreen-at=${(r) => this._drillTo(r.detail.camera, !0, r.detail.time)}
        ></upc-multi-view>
      </ha-card>
    `;
  }
  /** Resolved layout. Explicit config pins it; 'auto' (the default) picks by
   *  the card's own measured width — stacked below layout_breakpoint
   *  (portrait phone), columns at/above it (tablet / desktop / landscape
   *  phone). Rotation resizes the card, the ResizeObserver re-measures, and
   *  the layout flips live. Unmeasured (first paint) = stacked. */
  _isStacked() {
    const e = this._config?.layout ?? "auto";
    return e === "stacked" ? !0 : e === "columns" ? !1 : this._hostWidth === 0 || this._hostWidth < (this._config?.layout_breakpoint ?? 600);
  }
  /** One gallery tile: snapshot (HA camera proxy) + uppercase name. */
  _renderCamTile(e, t) {
    const i = this.hass.states[e.camera]?.attributes?.entity_picture, s = this._galleryOpen ? Math.floor(this._now / 1e4) : 0, r = i ? `${i}${i.includes("?") ? "&" : "?"}upc=${s}` : void 0, o = this._cameraName(e.camera);
    return p`<button
      class="cam-tile ${e.camera === t ? "active" : ""}"
      @click=${() => this._selectCamera(e.camera)}
    >
      ${r ? p`<img src=${r} alt=${o} />` : p`<div class="cam-ph"></div>`}
      <span class="cam-name">${o}</span>
    </button>`;
  }
  /** Days (encoded y*10000 + m*100 + d) that have at least one event — the
   *  Events view's calendar only offers these for selection. */
  _eventDayKeys() {
    const e = /* @__PURE__ */ new Set();
    for (const t of this._viewBands)
      for (const i of [t.start, t.end]) {
        const s = new Date(i);
        e.add(s.getFullYear() * 1e4 + s.getMonth() * 100 + s.getDate());
      }
    return e;
  }
  /** The dark mini-calendar above the date pill. Day availability follows the
   *  active view: Timeline = [today - calendar_days, today] (the footage
   *  window); Events = only days that actually HAVE events (the manifest
   *  window, ~7 days). The playhead's day is highlighted. Tapping a day is
   *  mode-aware too (see _selectCalDay). */
  _renderCalendar() {
    const { y: e, m: t } = this._calCursor, i = /* @__PURE__ */ new Date();
    i.setHours(0, 0, 0, 0);
    const s = new Date(i);
    s.setDate(s.getDate() - (this._config?.calendar_days ?? 30));
    const r = new Date(e, t, 1), o = r.getDay(), n = new Date(e, t + 1, 0).getDate(), a = new Date(this._domain ? P(this._domain, this._phFrac()) : Date.now()), h = (k) => a.getFullYear() === e && a.getMonth() === t && a.getDate() === k, u = Tt({
      month: "long",
      year: "numeric"
    }).format(r), d = Array.from(
      { length: 7 },
      (k, H) => Tt({ weekday: "narrow" }).format(new Date(2023, 0, H + 1))
    ), l = this._mode === "list" ? this._eventDayKeys() : void 0, _ = !!l && l.size > 0, v = e * 12 + t;
    let y = s.getFullYear() * 12 + s.getMonth();
    if (_) {
      let k = 1 / 0;
      for (const H of l) H < k && (k = H);
      y = Math.floor(k / 1e4) * 12 + Math.floor(k % 1e4 / 100);
    }
    const z = v > y, O = v < i.getFullYear() * 12 + i.getMonth(), N = [];
    for (let k = 0; k < o; k++) N.push(p`<span class="cal-cell"></span>`);
    for (let k = 1; k <= n; k++) {
      const H = new Date(e, t, k), Y = _ ? l.has(e * 1e4 + t * 100 + k) : H <= i && H >= s;
      N.push(
        p`<button
          class="cal-cell cal-day ${h(k) ? "sel" : ""}"
          ?disabled=${!Y}
          @click=${() => this._selectCalDay(e, t, k)}
        >
          ${k}
        </button>`
      );
    }
    return p`<div class="cal-pop ${this._isStacked() ? "" : "wide"}">
      <div class="cal-head">
        <span class="cal-title">${u}</span>
        <span>
          <button class="cal-chev" ?disabled=${!z} @click=${() => this._calShift(-1)}>
            <ha-icon icon="mdi:chevron-left"></ha-icon>
          </button>
          <button class="cal-chev" ?disabled=${!O} @click=${() => this._calShift(1)}>
            <ha-icon icon="mdi:chevron-right"></ha-icon>
          </button>
        </span>
      </div>
      <div class="cal-grid">
        ${d.map((k) => p`<span class="cal-cell cal-wk">${k}</span>`)}
        ${N}
      </div>
    </div>`;
  }
  /** The scrubber, in either of its two placements: the card's own timeline
   *  column, or — `overlay` — the strip slotted into the FULLSCREEN player
   *  (`slot="fs-timeline"`, rendered by the media view inside the dialog /
   *  fullscreen element, the only place visible there). Same element on the
   *  same shared domain — including its ZOOM — so the two stay in lockstep,
   *  and both behave identically: tapping an event thumbnail winds the ruler to
   *  that event and plays the continuous footage from there. Bounded event
   *  CLIPS are the Events list's job alone — no timeline starts one. The
   *  overlay differs only in look: mirrored onto the screen edge, chrome scaled
   *  for across-the-room reading, and its own jump-to-live arrow. */
  _renderScrubber(e) {
    const t = this._config, i = t.tick_size, s = typeof i == "number" ? i : { small: 4, medium: 8, large: 14 }[i ?? "medium"] ?? 8, r = this._isStacked();
    return p`
      <upc-scrubber-timeline
        slot=${e ? "fs-timeline" : b}
        ?mirror=${e}
        .zoomUi=${!0}
        .gutter=${e ? this._fsGutter() : 0}
        .rotated=${e && this._playerRotated}
        .liveArrow=${e}
        .compact=${r}
        .playheadFrac=${this._phFrac()}
        .domain=${this._domain}
        .bands=${this._viewBands}
        .gaps=${t.show_footage_gaps ?? !0 ? this._gaps : []}
        .gapColor=${t.gap_color ?? "#4a4a52"}
        .now=${this._now}
        .hass=${this.hass}
        .nvrId=${this._nvrId}
        .cameraId=${this._activeCamera || t.camera}
        .loader=${this._loader}
        .thumbVersion=${this._thumbVersion}
        .fontSize=${Math.round(
      (t.timeline_font_size ?? 12) * (e ? r ? Zr : Kr : 1)
    )}
        .fontColor=${t.timeline_font_color ?? "#d0d0d0"}
        .accentColor=${t.accent_color ?? "#fc9df3"}
        .tickColor=${e ? (
      // The card's tick color is picked against the timeline column's dark
      // background; over bright footage it disappears. The overlay's ruler
      // matches its own labels instead (light, like the UniFi app).
      t.timeline_font_color ?? "#d0d0d0"
    ) : t.tick_color ?? "#4f4f4f"}
        .tickSize=${s}
        .recordedColor=${t.recorded_color ?? "#6e476a"}
        .futureColor=${t.future_color ?? "#7a7a84"}
        .thumbSize=${t.thumb_size ?? 87}
        .thumbSizeActive=${t.thumb_size_active ?? 105}
        .live=${this._liveMode}
        .livePaused=${this._livePaused}
        .indent=${e ? 0 : r ? 75 : 60}
        .pillIndent=${e ? 0 : r ? 35 : 0}
        @scrub-start=${this._onScrubStart}
        @scrub=${this._onScrub}
        @scrub-end=${this._onScrubEnd}
        @scrub-cancel=${this._onScrubCancel}
        @domain-change=${this._onDomainChange}
      ></upc-scrubber-timeline>
    `;
  }
  render() {
    return this._config ? this._isMulti ? p`${Ii(this._drill ? b : this._renderMulti())}${this._drill ? this._renderSingle() : b}` : this._renderSingle() : b;
  }
  /** The single-camera page: a camera card, or the multi page drilled in. */
  _renderSingle() {
    if (!this._config) return b;
    if (!this._domain) return p`<ha-card><div class="header">Loading…</div></ha-card>`;
    if (!this._nvrId)
      return p`
        <ha-card>
          <div class="header">${this._config.title ?? "UniFi Protect Timeline"}</div>
          <div style="padding:8px;color:var(--error-color)">
            Could not resolve <code>nvr_id</code> for ${this._config.camera}. Add
            <code>nvr_id:</code> (your unifiprotect config-entry id) to the card config.
          </div>
        </ha-card>
      `;
    const e = this._activeCamera || this._config.camera;
    this._loader.configure(
      this.hass,
      this._nvrId,
      e,
      this._config.thumbnail_concurrency ?? 2
    );
    const t = this._config.show_footage_gaps ?? !0 ? this._gaps : [];
    this._loader.setGaps(t);
    const i = this._config.accent_color ?? "#fc9df3", s = this._config.fs_timeline ?? !0, r = this._isStacked(), o = this._config.fs_timeline_width ?? (r ? 120 : 165), n = this._fsPad(), a = this._fsGutter(), h = this._config.fs_timeline_grab_width ?? 0, u = this._config.fs_timeline_scrim ?? 0.88, d = this._config.fs_timeline_scrim_extend ?? (r ? 130 : 170), l = Tt({
      month: "short",
      day: "numeric"
    }).format(new Date(P(this._domain, this._phFrac()))), _ = this._isStacked(), v = this._config.tablet_events_thumbnail_size ?? 145, y = this._config.list_text_size ?? 12, z = Math.max(1, y - 1), O = v + 168, N = (_ ? "" : `flex-basis:${O}px;min-width:${O}px;`) + `--upc-accent:${i};--upc-arrow:${this._config.arrow_color ?? "rgba(0,0,0,0.6)"};--upc-arrow-bottom:${this._config.live_arrow_bottom ?? 14}px;--upc-date-size:${this._config.date_font_size ?? 13}px;--upc-date-color:${this._config.date_font_color ?? "#ffffff"};`, k = this._cameraEntries(), H = k.length ? this._cameraName(e) : this._config.title ?? "UniFi Protect Timeline", Y = this._config.video_ratio ?? 0.45, gt = Math.max(15, Math.min(85, Y > 1 ? Y : Y * 100)), dt = `height:${this._config.height || (_ ? "100dvh" : "80vh")}`, W = _ ? `--upc-video-frac:${gt}%` : "", $ = this._config.list_divider_color || i, R = (this._config.toggle_bg ? `--upc-toggle-bg:${this._config.toggle_bg};` : "") + (this._config.toggle_active_bg ? `--upc-toggle-active-bg:${this._config.toggle_active_bg};` : "") + (this._config.toggle_active_color ? `--upc-toggle-active-color:${this._config.toggle_active_color};` : "") + (this._config.toggle_text_color ? `--upc-toggle-text:${this._config.toggle_text_color};` : ""), q = _ && this._config.video_aspect ? `flex:0 0 auto;aspect-ratio:${this._config.video_aspect};width:100%;` : "", K = (k.length ? `--upc-title-weight:${this._config.camera_name_font_weight ?? 600};` : this._config.title_font_weight ? `--upc-title-weight:${this._config.title_font_weight};` : "") + (this._config.title_font_size ? `--upc-title-size:${this._config.title_font_size}px;` : "") + (this._config.title_font_color ? `--upc-title-color:${this._config.title_font_color};` : "");
    return p`
      <ha-card style=${dt}>
        <div class="header" style=${K}>
          ${this._config.back_button || this._drill ? p`<button
                class="back-btn"
                aria-label="Back"
                style=${`--upc-back-size:${this._config.back_button_size ?? 38}px`}
                @click=${this._goBack}
              >
                <ha-icon icon="mdi:chevron-left"></ha-icon>
              </button>` : b}
          <span class="title-text">${H}</span>
          ${k.length ? p`<button
                class="strip-toggle"
                @click=${this._toggleGallery}
                title=${this._galleryOpen ? "Hide cameras" : "Show cameras"}
              >
                <ha-icon
                  icon=${this._galleryOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                ></ha-icon>
              </button>` : b}
        </div>

        ${k.length ? p`<div
              class="cam-strip ${this._galleryOpen ? "open" : ""}"
              style="--upc-cam-tile-w:${v}px"
            >
              <div class="cam-strip-inner">
                ${k.map((ni) => this._renderCamTile(ni, e))}
              </div>
            </div>` : b}

        <div class="row ${_ ? "stacked" : ""}" style=${W}>
          <div class="timeline-col" style=${N}>
            <div class="view-toggle" style=${R}>
              <button
                class="seg ${this._mode === "timeline" ? "active" : ""}"
                @click=${this._showTimeline}
              >
                Timeline
              </button>
              <button
                class="seg ${this._mode === "list" ? "active" : ""}"
                @click=${this._showEvents}
              >
                Events
              </button>
            </div>

            <div class="mode-body">
              ${this._mode === "timeline" ? this._renderScrubber(!1) : p`
                    <upc-events-list
                      .bands=${this._viewBands}
                      .loader=${this._loader}
                      .thumbVersion=${this._thumbVersion}
                      .textSize=${y}
                      .textColor=${this._config.list_text_color ?? ""}
                      .durationSize=${z}
                      .durationColor=${this._config.list_duration_color ?? ""}
                      .thumbWidth=${v}
                      .line1White=${!0}
                      .activeTextSize=${this._config.list_active_text_size ?? 12}
                      .activeTextColor=${this._config.list_active_text_color ?? "#000"}
                      .activeDurationSize=${this._config.list_active_duration_size ?? 12}
                      .activeDurationColor=${this._config.list_active_duration_color ?? "#000"}
                      .activeBg=${this._config.list_active_bg ?? this._config.list_highlight_color ?? "#fff"}
                      .playingKey=${this._playingBand ? `${this._playingBand.type}@${this._playingBand.start}` : ""}
                      .dateFontSize=${this._config.date_font_size ?? 13}
                      .dateFontColor=${this._config.date_font_color ?? "#ffffff"}
                      .dividerColor=${$}
                      @event-selected=${this._onEventSelected}
                    ></upc-events-list>
                  `}
            </div>

            <button class="date-pill" @click=${this._toggleCal} title="Jump to date">
              <ha-icon icon="mdi:calendar-month-outline"></ha-icon>
              <span>${l}</span>
            </button>
            ${this._calOpen ? this._renderCalendar() : b}
            ${this._mode === "timeline" && !this._liveMode ? p`<button class="live-arrow" @click=${this._onLive} title="Jump to live">
                  ↑
                </button>` : b}
          </div>

          <div
            class="video-col"
            style=${q}
            @pointerdown=${this._onVideoPointerDown}
            @pointermove=${this._onVideoPointerMove}
            @pointerup=${this._onVideoPointerEnd}
            @pointercancel=${this._onVideoPointerEnd}
          >
            <upc-media-view
              .hass=${this.hass}
              .nvrId=${this._nvrId}
              .cameraId=${e}
              .gaps=${t}
              .targetTime=${this._targetTime}
              .scrubbing=${this._scrubbing}
              .live=${this._liveMode}
              .stacked=${this._isStacked()}
              .previewDir=${this._scrubDir()}
              .fastPreview=${this._config.scrub_fast_preview ?? "speed"}
              .accent=${i}
              .clipEndTime=${this._clipEnd}
              .now=${this._now}
              .liveAudioStart=${this._config.live_audio_start ?? "muted"}
              .startFs=${this._drillFs}
              .fsTimeline=${s}
              .fsTimelineWidth=${o}
              .fsTimelinePadding=${n}
              .fsTimelineGutter=${a}
              .fsTimelineGrabWidth=${h}
              .fsTimelineScrim=${u}
              .fsTimelineScrimExtend=${d}
              @playback-time=${this._onPlaybackTime}
              @playback-seek=${this._onPlaybackSeek}
              @live-playing=${this._onLivePlaying}
              @go-live=${this._onLive}
              @rewind=${this._onRewind}
              @fs-exit=${this._onMediaFsExit}
              @fs-change=${this._onPlayerFs}
            >
              ${s && this._playerFs ? this._renderScrubber(!0) : b}
            </upc-media-view>
          </div>
        </div>
      </ha-card>
    `;
  }
};
S.styles = rt`
    :host {
      /* custom elements default to inline — inline boxes measure width 0 in
         ResizeObserver, which would wedge layout:auto in stacked mode */
      display: block;
    }
    ha-card {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-sizing: border-box; /* inline height includes the padding */
    }
    /* Multi page body fills the card under the header, like .row does. */
    upc-multi-view {
      flex: 1 1 auto;
      min-height: 0;
    }
    /* Stacked multi page: the SCROLLER (upc-multi-view) must own the side
       padding, or the edge-to-edge strip/tiles overflow it horizontally and
       the whole page pans sideways. The card gives up its side padding here;
       multi-view re-applies it inside (see its :host([stacked]) rule). */
    ha-card.multi-stacked {
      padding-left: 0;
      padding-right: 0;
    }
    ha-card.multi-stacked .header {
      padding: 0 12px; /* header keeps the visual inset the card padding gave it */
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px; /* space between the back button and the title (no button → no effect) */
      /* Defaults match the rooms-overview room name (headline5 / 500);
         overridable via title_font_size / _color / _weight. */
      font-weight: var(--upc-title-weight, 500);
      font-size: var(--upc-title-size, var(--mdc-typography-headline5-font-size, 24px));
      color: var(--upc-title-color, var(--primary-text-color));
    }
    .title-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* In-card back button — a chevron in a dark circle (matches the dashboards'
       bubble back button). Sized by --upc-back-size (back_button_size). */
    .back-btn {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      padding: 4px;
      margin: 0;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      color: var(--primary-text-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .back-btn ha-icon {
      display: block;
      --mdc-icon-size: var(--upc-back-size, 38px);
      width: var(--upc-back-size, 38px);
      height: var(--upc-back-size, 38px);
    }
    /* Camera-carousel toggle next to the title: mouse/desktop affordance for
       what drag-down-on-the-video does on touch. Chevron flips with state.
       Deliberately NO background — a second pill next to the back button reads
       as clutter; the bare glyph is enough. */
    .strip-toggle {
      flex: 0 0 auto;
      width: 34px;
      height: 34px;
      border: none;
      background: transparent;
      padding: 0;
      color: var(--primary-text-color);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      -webkit-tap-highlight-color: transparent;
    }
    .strip-toggle ha-icon {
      --mdc-icon-size: 26px;
      display: block;
    }
    /* UniFi-style: vertical timeline on the left, large video on the right.
       Tall by design so it fills a full-width / panel dashboard view.
       BOTH layouts: the CARD carries the height (set inline) and the row
       flexes to fill what's left under the header — so opening the camera
       strip shrinks the row instead of growing the card (a growing card
       overflowed height-capped containers like the bubble pop-up, cropping
       the header off the top). */
    .row {
      display: flex;
      gap: 10px;
      align-items: stretch;
      flex: 1 1 auto;
      min-height: 0;
    }
    .timeline-col {
      flex: 0 0 220px;
      min-width: 220px;
      position: relative;
      z-index: 2; /* enlarged thumbnails overflow over the video */
      display: flex;
      flex-direction: column;
      gap: 10px; /* matches the card's global 10px rhythm (video->toggle->timeline) */
    }
    /* Segmented Timeline | Events switch (UniFi-style), shared by both views.
       Track matches the bubble-card pop-up close button background (same var
       chain) so it blends with the popup; the active segment is a lighter
       raised fill so it stands out regardless of what the track resolves to. */
    .view-toggle {
      display: flex;
      gap: 3px;
      flex: 0 0 auto;
      padding: 3px;
      border-radius: 10px;
      /* subtle border so the two buttons read as one grouped control */
      border: 1px solid rgba(255, 255, 255, 0.1);
      /* Track behind both buttons. Overridable via toggle_bg; default = the
         bubble-card pop-up close-button background chain so it blends in. */
      background: var(
        --upc-toggle-bg,
        var(
          --bubble-sub-button-background-color,
          var(
            --bubble-icon-background-color,
            var(
              --bubble-secondary-background-color,
              var(--card-background-color, var(--ha-card-background, rgba(127, 127, 127, 0.14)))
            )
          )
        )
      );
    }
    .seg {
      flex: 1 1 0;
      border: none;
      border-radius: 8px;
      padding: 7px 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      background: transparent;
      color: var(--upc-toggle-text, var(--secondary-text-color));
      transition:
        background 0.15s ease,
        color 0.15s ease;
    }
    .seg:hover {
      color: var(--primary-text-color);
    }
    .seg.active {
      /* default matches the dark floating pills (date / zoom / live arrow) */
      background: var(--upc-toggle-active-bg, rgba(0, 0, 0, 0.6));
      color: var(--upc-toggle-active-color, #fff);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    }
    /* Fills the column under the header; the chosen view manages its own scroll. */
    .mode-body {
      flex: 1 1 auto;
      min-height: 0;
      position: relative;
    }
    .video-col {
      flex: 1 1 auto;
      min-width: 0;
      position: relative;
      z-index: 1;
      /* The open/close-gallery drag lives here; nothing scrolls in this pane,
         so opting out of native touch handling costs nothing and makes iOS
         Safari deliver every pointermove. Taps still reach the video controls. */
      touch-action: none;
    }
    /* Camera gallery strip (config \`cameras:\`): a horizontal carousel between
       the header and the video. Opened by dragging DOWN on the video, closed
       ONLY by dragging UP (picking a camera keeps it open). Everything below
       (video + timeline) just slides down; the timeline stays visible and
       fully usable while the strip is open. Animated via max-height. */
    .cam-strip {
      flex: 0 0 auto;
      max-height: 0;
      opacity: 0;
      overflow: hidden;
      /* Collapsed: cancel one of the two ha-card flex gaps this extra child
         introduces, so header->video spacing is unchanged. Open: margin back
         to 0 so header->strip and strip->video get the SAME 10px gap. */
      margin-top: -10px;
      transition:
        max-height 0.22s ease,
        margin-top 0.22s ease,
        opacity 0.22s ease;
    }
    .cam-strip.open {
      max-height: 132px;
      margin-top: 0;
      opacity: 1;
    }
    .cam-strip-inner {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      /* symmetric so the strip sits evenly between header and video */
      padding: 4px 2px;
    }
    .cam-strip-inner::-webkit-scrollbar {
      display: none;
    }
    .cam-tile {
      flex: 0 0 auto;
      /* Same width as the event thumbnails (universal across the card). */
      width: var(--upc-cam-tile-w, 145px);
      box-sizing: border-box; /* active padding insets inward, tile stays 145px */
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      text-align: left;
      -webkit-tap-highlight-color: transparent;
    }
    .cam-tile img,
    .cam-tile .cam-ph {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 10; /* match the event thumbnails' aspect */
      object-fit: cover;
      border-radius: 10px;
      background: #000;
      border: 2px solid transparent;
      box-sizing: border-box;
    }
    /* Selected camera: the WHOLE tile becomes a white card (like a currently-
       playing event row), name goes black. The thumbnail is INSET by the tile's
       padding so the white reads as an even frame/mat on all sides (not just a
       strip under the name) — a framed-photo look. */
    .cam-tile.active {
      background: #fff;
      border-radius: 12px;
      padding: 5px; /* the white frame around the inset thumbnail + name */
    }
    .cam-tile.active img,
    .cam-tile.active .cam-ph {
      border: none; /* the frame is the tile padding now */
      border-radius: 7px; /* concentric inside the 12px card */
    }
    /* Same type as the multi page's live-tile name overlay (14px/700 white,
       normal case) — the active tile is marked by its white border instead. */
    .cam-name {
      display: block;
      margin-top: 5px;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cam-tile.active .cam-name {
      color: #000; /* black on the white card */
      margin-top: 4px;
      padding: 0; /* the tile's 5px padding already frames the name */
    }
    /* Floating date pill (bottom-left, over the timeline — UniFi style).
       Rendered by the CARD, not the scrubber, so it floats over either view.
       Same baseline as the jump-to-live arrow. */
    .date-pill {
      position: absolute;
      left: 10px;
      bottom: calc(var(--upc-arrow-bottom, 14px) + 15px);
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 16px 9px 12px;
      border: none;
      border-radius: 22px;
      cursor: pointer;
      color: var(--upc-date-color, #fff);
      font-size: var(--upc-date-size, 13px);
      font-weight: 600;
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      z-index: 10;
      -webkit-tap-highlight-color: transparent;
    }
    .date-pill ha-icon {
      --mdc-icon-size: 18px;
      display: block;
    }
    /* Jump-to-live arrow (bottom-right, same line as the date pill), rendered
       by the CARD so it floats over either view. Background matches the dark
       pills (overridable via arrow_color). Shown only when not live. */
    .live-arrow {
      position: absolute;
      right: 8px;
      bottom: calc(var(--upc-arrow-bottom, 14px) + 15px);
      /* same size as the collapsed zoom button */
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 22px;
      line-height: 1;
      background: var(--upc-arrow, rgba(0, 0, 0, 0.6));
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      z-index: 10;
    }
    /* Dark mini-calendar popped up from the date pill. Stacked (phone): full
       card width so the day grid reads comfortably. Columns (tablet): the
       220px timeline column can't fit the 44px day cells, so .wide breaks out
       to a fixed width and overlays the video (timeline-col z-index wins). */
    .cal-pop {
      position: absolute;
      left: 10px;
      right: 10px;
      bottom: calc(var(--upc-arrow-bottom, 14px) + 63px);
      padding: 16px;
      box-sizing: border-box;
      border-radius: 16px;
      background: var(--upc-cal-bg, rgb(38, 33, 43));
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
      z-index: 11;
    }
    .cal-pop.wide {
      right: auto;
      width: 366px; /* 7×44px cells + 6×4px gaps + 2×16px padding */
    }
    .cal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .cal-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--primary-text-color);
      padding-left: 4px;
    }
    .cal-chev {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--primary-text-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .cal-chev[disabled] {
      opacity: 0.3;
      cursor: default;
    }
    .cal-chev ha-icon {
      --mdc-icon-size: 26px;
      display: block;
      margin: 0 auto;
    }
    .cal-grid {
      display: grid;
      /* minmax(0, 1fr): columns may shrink below the cells' preferred size on
         narrow phones — fixed 44px cells need 366px and overflowed the popup
         on the right on real (375-390pt) iPhones. */
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
      justify-items: center;
    }
    .cal-cell {
      width: 100%;
      max-width: 44px;
      aspect-ratio: 1 / 1; /* shrinks with the column, stays circular */
      height: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .cal-wk {
      aspect-ratio: auto;
      height: 28px;
      color: var(--secondary-text-color);
      font-size: 13px;
      font-weight: 600;
    }
    .cal-day {
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--primary-text-color);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .cal-day[disabled] {
      opacity: 0.3;
      cursor: default;
    }
    .cal-day.sel {
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      color: #fff;
      font-weight: 700;
    }
    /* Stacked layout (phones): video on top, timeline/events full-width below.
       DOM order stays timeline-col -> video-col (so 'columns' is unchanged); we
       reorder visually with the order property. Video height = --upc-video-frac. */
    .row.stacked {
      flex-direction: column;
    }
    .row.stacked > .video-col {
      flex: 0 0 var(--upc-video-frac, 45%);
      order: 0;
      min-height: 0;
    }
    .row.stacked > .timeline-col {
      flex: 1 1 auto;
      order: 1;
      width: 100%;
      min-width: 0;
      min-height: 0;
    }
    .legend {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 11px;
      color: var(--secondary-text-color);
      padding: 0 2px;
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .legend i {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      display: inline-block;
    }
  `;
T([
  c({ attribute: !1 })
], S.prototype, "hass", 2);
T([
  m()
], S.prototype, "_config", 2);
T([
  m()
], S.prototype, "_domain", 2);
T([
  m()
], S.prototype, "_gaps", 2);
T([
  m()
], S.prototype, "_targetTime", 2);
T([
  m()
], S.prototype, "_scrubbing", 2);
T([
  m()
], S.prototype, "_liveMode", 2);
T([
  m()
], S.prototype, "_livePaused", 2);
T([
  m()
], S.prototype, "_now", 2);
T([
  m()
], S.prototype, "_nvrId", 2);
T([
  m()
], S.prototype, "_mode", 2);
T([
  m()
], S.prototype, "_activeCamera", 2);
T([
  m()
], S.prototype, "_drill", 2);
T([
  m()
], S.prototype, "_playerFs", 2);
T([
  m()
], S.prototype, "_playerRotated", 2);
T([
  m()
], S.prototype, "_galleryOpen", 2);
T([
  m()
], S.prototype, "_calOpen", 2);
T([
  m()
], S.prototype, "_calCursor", 2);
T([
  m()
], S.prototype, "_hostWidth", 2);
T([
  m()
], S.prototype, "_thumbVersion", 2);
T([
  m()
], S.prototype, "_playingBand", 2);
T([
  m()
], S.prototype, "_clipEnd", 2);
T([
  m()
], S.prototype, "_manifestBands", 2);
T([
  Fi("upc-scrubber-timeline")
], S.prototype, "_timelines", 2);
S = T([
  ot("unifi-protect-timeline-card")
], S);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "unifi-protect-timeline-card",
  name: "UniFi Protect Timeline",
  description: "UniFi Protect-style touch scrubber for camera footage and detections",
  preview: !1
});
console.info(
  `%c UNIFI-PROTECT-TIMELINE-CARD %c v${qr} `,
  "color:#fff;background:#03a9f4;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px",
  "color:#03a9f4;background:#222;border-radius:0 3px 3px 0;padding:2px 4px"
);
export {
  S as UnifiProtectTimelineCard
};

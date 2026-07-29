/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const $t = globalThis, Ot = $t.ShadowRoot && ($t.ShadyCSS === void 0 || $t.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, It = Symbol(), qt = /* @__PURE__ */ new WeakMap();
let we = class {
  constructor(t, i, s) {
    if (this._$cssResult$ = !0, s !== It) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = i;
  }
  get styleSheet() {
    let t = this.o;
    const i = this.t;
    if (Ot && t === void 0) {
      const s = i !== void 0 && i.length === 1;
      s && (t = qt.get(i)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && qt.set(i, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Ne = (e) => new we(typeof e == "string" ? e : e + "", void 0, It), st = (e, ...t) => {
  const i = e.length === 1 ? e[0] : t.reduce((s, o, r) => s + ((a) => {
    if (a._$cssResult$ === !0) return a.cssText;
    if (typeof a == "number") return a;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + a + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(o) + e[r + 1], e[0]);
  return new we(i, e, It);
}, Ue = (e, t) => {
  if (Ot) e.adoptedStyleSheets = t.map((i) => i instanceof CSSStyleSheet ? i : i.styleSheet);
  else for (const i of t) {
    const s = document.createElement("style"), o = $t.litNonce;
    o !== void 0 && s.setAttribute("nonce", o), s.textContent = i.cssText, e.appendChild(s);
  }
}, Gt = Ot ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((t) => {
  let i = "";
  for (const s of t.cssRules) i += s.cssText;
  return Ne(i);
})(e) : e;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: We, defineProperty: He, getOwnPropertyDescriptor: je, getOwnPropertyNames: qe, getOwnPropertySymbols: Ge, getPrototypeOf: Ye } = Object, Pt = globalThis, Yt = Pt.trustedTypes, Xe = Yt ? Yt.emptyScript : "", Ke = Pt.reactiveElementPolyfillSupport, ut = (e, t) => e, St = { toAttribute(e, t) {
  switch (t) {
    case Boolean:
      e = e ? Xe : null;
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
} }, Bt = (e, t) => !We(e, t), Xt = { attribute: !0, type: String, converter: St, reflect: !1, useDefault: !1, hasChanged: Bt };
Symbol.metadata ??= Symbol("metadata"), Pt.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let rt = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, i = Xt) {
    if (i.state && (i.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((i = Object.create(i)).wrapped = !0), this.elementProperties.set(t, i), !i.noAccessor) {
      const s = Symbol(), o = this.getPropertyDescriptor(t, s, i);
      o !== void 0 && He(this.prototype, t, o);
    }
  }
  static getPropertyDescriptor(t, i, s) {
    const { get: o, set: r } = je(this.prototype, t) ?? { get() {
      return this[i];
    }, set(a) {
      this[i] = a;
    } };
    return { get: o, set(a) {
      const n = o?.call(this);
      r?.call(this, a), this.requestUpdate(t, n, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Xt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(ut("elementProperties"))) return;
    const t = Ye(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(ut("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(ut("properties"))) {
      const i = this.properties, s = [...qe(i), ...Ge(i)];
      for (const o of s) this.createProperty(o, i[o]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const i = litPropertyMetadata.get(t);
      if (i !== void 0) for (const [s, o] of i) this.elementProperties.set(s, o);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [i, s] of this.elementProperties) {
      const o = this._$Eu(i, s);
      o !== void 0 && this._$Eh.set(o, i);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const i = [];
    if (Array.isArray(t)) {
      const s = new Set(t.flat(1 / 0).reverse());
      for (const o of s) i.unshift(Gt(o));
    } else t !== void 0 && i.push(Gt(t));
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
    return Ue(t, this.constructor.elementStyles), t;
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
    const s = this.constructor.elementProperties.get(t), o = this.constructor._$Eu(t, s);
    if (o !== void 0 && s.reflect === !0) {
      const r = (s.converter?.toAttribute !== void 0 ? s.converter : St).toAttribute(i, s.type);
      this._$Em = t, r == null ? this.removeAttribute(o) : this.setAttribute(o, r), this._$Em = null;
    }
  }
  _$AK(t, i) {
    const s = this.constructor, o = s._$Eh.get(t);
    if (o !== void 0 && this._$Em !== o) {
      const r = s.getPropertyOptions(o), a = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : St;
      this._$Em = o;
      const n = a.fromAttribute(i, r.type);
      this[o] = n ?? this._$Ej?.get(o) ?? n, this._$Em = null;
    }
  }
  requestUpdate(t, i, s, o = !1, r) {
    if (t !== void 0) {
      const a = this.constructor;
      if (o === !1 && (r = this[t]), s ??= a.getPropertyOptions(t), !((s.hasChanged ?? Bt)(r, i) || s.useDefault && s.reflect && r === this._$Ej?.get(t) && !this.hasAttribute(a._$Eu(t, s)))) return;
      this.C(t, i, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, i, { useDefault: s, reflect: o, wrapped: r }, a) {
    s && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, a ?? i ?? this[t]), r !== !0 || a !== void 0) || (this._$AL.has(t) || (this.hasUpdated || s || (i = void 0), this._$AL.set(t, i)), o === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
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
        for (const [o, r] of this._$Ep) this[o] = r;
        this._$Ep = void 0;
      }
      const s = this.constructor.elementProperties;
      if (s.size > 0) for (const [o, r] of s) {
        const { wrapped: a } = r, n = this[o];
        a !== !0 || this._$AL.has(o) || n === void 0 || this.C(o, void 0, r, n);
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
rt.elementStyles = [], rt.shadowRootOptions = { mode: "open" }, rt[ut("elementProperties")] = /* @__PURE__ */ new Map(), rt[ut("finalized")] = /* @__PURE__ */ new Map(), Ke?.({ ReactiveElement: rt }), (Pt.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Vt = globalThis, Kt = (e) => e, Tt = Vt.trustedTypes, Zt = Tt ? Tt.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, ye = "$lit$", X = `lit$${Math.random().toFixed(9).slice(2)}$`, xe = "?" + X, Ze = `<${xe}>`, tt = document, _t = () => tt.createComment(""), ft = (e) => e === null || typeof e != "object" && typeof e != "function", Nt = Array.isArray, Je = (e) => Nt(e) || typeof e?.[Symbol.iterator] == "function", Et = `[ 	
\f\r]`, ct = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Jt = /-->/g, Qt = />/g, Z = RegExp(`>|${Et}(?:([^\\s"'>=/]+)(${Et}*=${Et}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), te = /'/g, ee = /"/g, $e = /^(?:script|style|textarea|title)$/i, Qe = (e) => (t, ...i) => ({ _$litType$: e, strings: t, values: i }), c = Qe(1), et = Symbol.for("lit-noChange"), v = Symbol.for("lit-nothing"), ie = /* @__PURE__ */ new WeakMap(), Q = tt.createTreeWalker(tt, 129);
function ke(e, t) {
  if (!Nt(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Zt !== void 0 ? Zt.createHTML(t) : t;
}
const ti = (e, t) => {
  const i = e.length - 1, s = [];
  let o, r = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", a = ct;
  for (let n = 0; n < i; n++) {
    const l = e[n];
    let p, _, d = -1, g = 0;
    for (; g < l.length && (a.lastIndex = g, _ = a.exec(l), _ !== null); ) g = a.lastIndex, a === ct ? _[1] === "!--" ? a = Jt : _[1] !== void 0 ? a = Qt : _[2] !== void 0 ? ($e.test(_[2]) && (o = RegExp("</" + _[2], "g")), a = Z) : _[3] !== void 0 && (a = Z) : a === Z ? _[0] === ">" ? (a = o ?? ct, d = -1) : _[1] === void 0 ? d = -2 : (d = a.lastIndex - _[2].length, p = _[1], a = _[3] === void 0 ? Z : _[3] === '"' ? ee : te) : a === ee || a === te ? a = Z : a === Jt || a === Qt ? a = ct : (a = Z, o = void 0);
    const b = a === Z && e[n + 1].startsWith("/>") ? " " : "";
    r += a === ct ? l + Ze : d >= 0 ? (s.push(p), l.slice(0, d) + ye + l.slice(d) + X + b) : l + X + (d === -2 ? n : b);
  }
  return [ke(e, r + (e[i] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class mt {
  constructor({ strings: t, _$litType$: i }, s) {
    let o;
    this.parts = [];
    let r = 0, a = 0;
    const n = t.length - 1, l = this.parts, [p, _] = ti(t, i);
    if (this.el = mt.createElement(p, s), Q.currentNode = this.el.content, i === 2 || i === 3) {
      const d = this.el.content.firstChild;
      d.replaceWith(...d.childNodes);
    }
    for (; (o = Q.nextNode()) !== null && l.length < n; ) {
      if (o.nodeType === 1) {
        if (o.hasAttributes()) for (const d of o.getAttributeNames()) if (d.endsWith(ye)) {
          const g = _[a++], b = o.getAttribute(d).split(X), x = /([.?@])?(.*)/.exec(g);
          l.push({ type: 1, index: r, name: x[2], strings: b, ctor: x[1] === "." ? ii : x[1] === "?" ? si : x[1] === "@" ? oi : Ct }), o.removeAttribute(d);
        } else d.startsWith(X) && (l.push({ type: 6, index: r }), o.removeAttribute(d));
        if ($e.test(o.tagName)) {
          const d = o.textContent.split(X), g = d.length - 1;
          if (g > 0) {
            o.textContent = Tt ? Tt.emptyScript : "";
            for (let b = 0; b < g; b++) o.append(d[b], _t()), Q.nextNode(), l.push({ type: 2, index: ++r });
            o.append(d[g], _t());
          }
        }
      } else if (o.nodeType === 8) if (o.data === xe) l.push({ type: 2, index: r });
      else {
        let d = -1;
        for (; (d = o.data.indexOf(X, d + 1)) !== -1; ) l.push({ type: 7, index: r }), d += X.length - 1;
      }
      r++;
    }
  }
  static createElement(t, i) {
    const s = tt.createElement("template");
    return s.innerHTML = t, s;
  }
}
function nt(e, t, i = e, s) {
  if (t === et) return t;
  let o = s !== void 0 ? i._$Co?.[s] : i._$Cl;
  const r = ft(t) ? void 0 : t._$litDirective$;
  return o?.constructor !== r && (o?._$AO?.(!1), r === void 0 ? o = void 0 : (o = new r(e), o._$AT(e, i, s)), s !== void 0 ? (i._$Co ??= [])[s] = o : i._$Cl = o), o !== void 0 && (t = nt(e, o._$AS(e, t.values), o, s)), t;
}
class ei {
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
    const { el: { content: i }, parts: s } = this._$AD, o = (t?.creationScope ?? tt).importNode(i, !0);
    Q.currentNode = o;
    let r = Q.nextNode(), a = 0, n = 0, l = s[0];
    for (; l !== void 0; ) {
      if (a === l.index) {
        let p;
        l.type === 2 ? p = new lt(r, r.nextSibling, this, t) : l.type === 1 ? p = new l.ctor(r, l.name, l.strings, this, t) : l.type === 6 && (p = new ri(r, this, t)), this._$AV.push(p), l = s[++n];
      }
      a !== l?.index && (r = Q.nextNode(), a++);
    }
    return Q.currentNode = tt, o;
  }
  p(t) {
    let i = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(t, s, i), i += s.strings.length - 2) : s._$AI(t[i])), i++;
  }
}
class lt {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, i, s, o) {
    this.type = 2, this._$AH = v, this._$AN = void 0, this._$AA = t, this._$AB = i, this._$AM = s, this.options = o, this._$Cv = o?.isConnected ?? !0;
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
    t = nt(this, t, i), ft(t) ? t === v || t == null || t === "" ? (this._$AH !== v && this._$AR(), this._$AH = v) : t !== this._$AH && t !== et && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Je(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== v && ft(this._$AH) ? this._$AA.nextSibling.data = t : this.T(tt.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: i, _$litType$: s } = t, o = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = mt.createElement(ke(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === o) this._$AH.p(i);
    else {
      const r = new ei(o, this), a = r.u(this.options);
      r.p(i), this.T(a), this._$AH = r;
    }
  }
  _$AC(t) {
    let i = ie.get(t.strings);
    return i === void 0 && ie.set(t.strings, i = new mt(t)), i;
  }
  k(t) {
    Nt(this._$AH) || (this._$AH = [], this._$AR());
    const i = this._$AH;
    let s, o = 0;
    for (const r of t) o === i.length ? i.push(s = new lt(this.O(_t()), this.O(_t()), this, this.options)) : s = i[o], s._$AI(r), o++;
    o < i.length && (this._$AR(s && s._$AB.nextSibling, o), i.length = o);
  }
  _$AR(t = this._$AA.nextSibling, i) {
    for (this._$AP?.(!1, !0, i); t !== this._$AB; ) {
      const s = Kt(t).nextSibling;
      Kt(t).remove(), t = s;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class Ct {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, i, s, o, r) {
    this.type = 1, this._$AH = v, this._$AN = void 0, this.element = t, this.name = i, this._$AM = o, this.options = r, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = v;
  }
  _$AI(t, i = this, s, o) {
    const r = this.strings;
    let a = !1;
    if (r === void 0) t = nt(this, t, i, 0), a = !ft(t) || t !== this._$AH && t !== et, a && (this._$AH = t);
    else {
      const n = t;
      let l, p;
      for (t = r[0], l = 0; l < r.length - 1; l++) p = nt(this, n[s + l], i, l), p === et && (p = this._$AH[l]), a ||= !ft(p) || p !== this._$AH[l], p === v ? t = v : t !== v && (t += (p ?? "") + r[l + 1]), this._$AH[l] = p;
    }
    a && !o && this.j(t);
  }
  j(t) {
    t === v ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class ii extends Ct {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === v ? void 0 : t;
  }
}
class si extends Ct {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== v);
  }
}
class oi extends Ct {
  constructor(t, i, s, o, r) {
    super(t, i, s, o, r), this.type = 5;
  }
  _$AI(t, i = this) {
    if ((t = nt(this, t, i, 0) ?? v) === et) return;
    const s = this._$AH, o = t === v && s !== v || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, r = t !== v && (s === v || o);
    o && this.element.removeEventListener(this.name, this, s), r && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class ri {
  constructor(t, i, s) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = i, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    nt(this, t);
  }
}
const ai = { I: lt }, ni = Vt.litHtmlPolyfillSupport;
ni?.(mt, lt), (Vt.litHtmlVersions ??= []).push("3.3.3");
const li = (e, t, i) => {
  const s = i?.renderBefore ?? t;
  let o = s._$litPart$;
  if (o === void 0) {
    const r = i?.renderBefore ?? null;
    s._$litPart$ = o = new lt(t.insertBefore(_t(), r), r, void 0, i ?? {});
  }
  return o._$AI(e), o;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ut = globalThis;
let j = class extends rt {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const i = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = li(i, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return et;
  }
};
j._$litElement$ = !0, j.finalized = !0, Ut.litElementHydrateSupport?.({ LitElement: j });
const hi = Ut.litElementPolyfillSupport;
hi?.({ LitElement: j });
(Ut.litElementVersions ??= []).push("4.2.2");
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
const ci = { attribute: !0, type: String, converter: St, reflect: !1, hasChanged: Bt }, di = (e = ci, t, i) => {
  const { kind: s, metadata: o } = i;
  let r = globalThis.litPropertyMetadata.get(o);
  if (r === void 0 && globalThis.litPropertyMetadata.set(o, r = /* @__PURE__ */ new Map()), s === "setter" && ((e = Object.create(e)).wrapped = !0), r.set(i.name, e), s === "accessor") {
    const { name: a } = i;
    return { set(n) {
      const l = t.get.call(this);
      t.set.call(this, n), this.requestUpdate(a, l, e, !0, n);
    }, init(n) {
      return n !== void 0 && this.C(a, void 0, e, n), n;
    } };
  }
  if (s === "setter") {
    const { name: a } = i;
    return function(n) {
      const l = this[a];
      t.call(this, n), this.requestUpdate(a, l, e, !0, n);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function h(e) {
  return (t, i) => typeof i == "object" ? di(e, t, i) : ((s, o, r) => {
    const a = o.hasOwnProperty(r);
    return o.constructor.createProperty(r, s), a ? Object.getOwnPropertyDescriptor(o, r) : void 0;
  })(e, t, i);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function f(e) {
  return h({ ...e, state: !0, attribute: !1 });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Se = (e, t, i) => (i.configurable = !0, i.enumerable = !0, Reflect.decorate && typeof t != "object" && Object.defineProperty(e, t, i), i);
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function U(e, t) {
  return (i, s, o) => {
    const r = (a) => a.renderRoot?.querySelector(e) ?? null;
    return Se(i, s, { get() {
      return r(this);
    } });
  };
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
let pi;
function ui(e) {
  return (t, i) => Se(t, i, { get() {
    return (this.renderRoot ?? (pi ??= document.createDocumentFragment())).querySelectorAll(e);
  } });
}
const _i = "/protect_scrub", Wt = "/protect_thumbs", se = "/local/protect_thumbs";
function fi(e) {
  return e.startsWith(`${se}/`) ? Wt + e.slice(se.length) : e;
}
function gt(e) {
  return (e instanceof Date ? e : new Date(e)).toISOString();
}
function mi(e, t, i, s) {
  return `/api/unifiprotect/video/${encodeURIComponent(e)}/${encodeURIComponent(
    t
  )}/${encodeURIComponent(gt(i))}/${encodeURIComponent(gt(s))}`;
}
function Te(e, t, i, s) {
  let o = `/api/unifiprotect/snapshot/${encodeURIComponent(e)}/${encodeURIComponent(
    t
  )}/${encodeURIComponent(gt(i))}`;
  const r = [];
  return s?.width && r.push(`width=${Math.round(s.width)}`), s?.height && r.push(`height=${Math.round(s.height)}`), r.length && (o += `?${r.join("&")}`), o;
}
function Ht(e, t, i) {
  if (e.fetchWithAuth) return e.fetchWithAuth(t, i);
  const s = e.auth?.accessToken;
  return fetch(t, {
    ...i,
    headers: { ...i.headers, ...s ? { Authorization: `Bearer ${s}` } : {} }
  });
}
async function gi(e, t, i, s, o, r) {
  const a = await Ht(e, "/api/protect_clip/session", {
    method: "POST",
    signal: r,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nvr_id: t,
      camera_id: i,
      start: gt(s),
      end: gt(o)
    })
  });
  if (!a.ok) {
    const n = await a.text().catch(() => "");
    throw new Error(`clip session failed (${a.status}) ${n}`);
  }
  return await a.json();
}
function oe(e, t) {
  Ht(e, `/api/protect_clip/session/${encodeURIComponent(t)}`, {
    method: "DELETE",
    keepalive: !0
    // survives the view being torn down mid-flight
  }).catch(() => {
  });
}
async function Pe(e, t, i = 300) {
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
const vi = 3 * 6e4, bi = {
  motion: { label: "Motion", color: "#5c8aff" },
  person: { label: "Person", color: "#3ddc84" },
  vehicle: { label: "Vehicle", color: "#ffb300" },
  animal: { label: "Animal", color: "#ab47bc" }
};
function Ce(e) {
  const t = bi[e.kind] ?? {
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
    file: e.file ? fi(e.file) : void 0,
    durMs: e.dur,
    ongoing: e.ongoing
  };
}
async function Ae(e) {
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
        stale: Date.now() - (i.generated ?? 0) > vi
      };
  } catch {
  }
}
const Ee = 1e3, it = 60 * Ee, wi = 60 * it, Rt = 4 * it, Me = 60 * it, O = (() => {
  const t = Math.pow(Me / Rt, 0.034482758620689655);
  return Array.from({ length: 30 }, (i, s) => Math.round(Rt * Math.pow(t, s)));
})(), At = 0.15, yi = 0.179;
function M(e) {
  return e.end - e.start;
}
function xi(e) {
  return Math.min(Me, Math.max(Rt, e));
}
function C(e, t = At) {
  return e.end - M(e) * t;
}
const $i = it, ki = 6 * wi;
function N(e, t, i = At) {
  const s = Math.min(ki, Math.max($i, t)), o = e + s * i;
  return { start: o - s, end: o };
}
function Si(e, t) {
  let i = 0, s = 1 / 0;
  for (let r = 0; r < O.length; r++) {
    const a = Math.abs(O[r] - e);
    a < s && (s = a, i = r);
  }
  const o = Math.min(O.length - 1, Math.max(0, i + t));
  return O[o];
}
function re(e, t) {
  const i = -new Date(e.start).getTimezoneOffset() * 6e4, s = Math.ceil((e.start + i) / t) * t - i, o = [];
  for (let r = s; r <= e.end; r += t) o.push(r);
  return o;
}
const Ti = 1500;
function Pi(e) {
  const t = (e.s ?? e.state ?? "").toString();
  let i;
  return typeof e.lu == "number" ? i = e.lu * 1e3 : typeof e.lc == "number" ? i = e.lc * 1e3 : e.last_updated ? i = Date.parse(e.last_updated) : e.last_changed && (i = Date.parse(e.last_changed)), i === void 0 || Number.isNaN(i) || !t ? null : { state: t, ts: i };
}
const Ci = /* @__PURE__ */ new Set(["unavailable", "unknown"]);
function Ai(e, t, i, s = Ti) {
  const o = e.map(Pi).filter((n) => n !== null).sort((n, l) => n.ts - l.ts), r = [];
  let a = null;
  for (const n of o)
    if (Ci.has(n.state))
      a === null && (a = Math.max(n.ts, t));
    else if (a !== null) {
      const l = Math.min(n.ts, i);
      l - a >= s && r.push({ start: a, end: l }), a = null;
    }
  return a !== null && i - a >= s && r.push({ start: a, end: i }), r;
}
const Ei = [0.5, 0.15, 0.85], wt = /* @__PURE__ */ new Map(), Mi = 500;
async function zi(e, t, i, s) {
  const o = new AbortController();
  try {
    const a = (await Ht(e, Te(t, i, s), {
      signal: o.signal
    })).status === 200;
    return o.abort(), a;
  } catch {
    return null;
  }
}
async function Fi(e, t, i, s, o = 24) {
  if (!t || !i || !s.length) return s;
  const r = [];
  let a = o;
  for (const n of s) {
    const l = `${i}|${n.start}|${n.end}`, p = wt.get(l);
    if (p !== void 0) {
      p && r.push(n);
      continue;
    }
    let _ = !1;
    for (const d of Ei) {
      if (a <= 0) break;
      a--;
      const g = await zi(e, t, i, n.start + (n.end - n.start) * d);
      if (g !== null && g) {
        _ = !0;
        break;
      }
    }
    _ || r.push(n), (_ || a > 0) && (wt.size >= Mi && wt.clear(), wt.set(l, !_));
  }
  return r;
}
async function Ri(e, t, i, s, o = "") {
  if (!t) return [];
  let r;
  try {
    r = await e.callWS({
      type: "history/history_during_period",
      start_time: new Date(i).toISOString(),
      end_time: new Date(s).toISOString(),
      entity_ids: [t],
      minimal_response: !0,
      no_attributes: !0,
      significant_changes_only: !1
    });
  } catch (n) {
    return console.error("[unifi-timeline] gap history fetch failed", n), [];
  }
  const a = Ai(r[t] ?? [], i, s);
  return Fi(e, o, t, a);
}
function ze(e, t) {
  for (const i of e) if (t >= i.start && t <= i.end) return !0;
  return !1;
}
function kt(e) {
  history.pushState(null, "", e), window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: !1 } }));
}
const ae = ["person", "vehicle", "animal", "package", "license plate"];
function ne(e) {
  const t = ae.indexOf(e.label.toLowerCase());
  return t === -1 ? ae.length : t;
}
function Fe(e, t) {
  if (t <= 0 || e.length === 0) return e;
  const i = [...e].sort((a, n) => a.start - n.start), s = [];
  let o = [i[0]], r = i[0].end;
  for (let a = 1; a < i.length; a++) {
    const n = i[a];
    n.start - r <= t ? (o.push(n), r = Math.max(r, n.end)) : (s.push(o), o = [n], r = n.end);
  }
  return s.push(o), s.map(Di).sort((a, n) => n.start - a.start);
}
function Di(e) {
  const t = e[0];
  if (e.length === 1) return { ...t, members: e };
  const i = e.reduce((a, n) => Math.max(a, n.end), t.end), s = e.reduce((a, n) => ne(n) < ne(a) ? n : a, t), o = e.find((a) => a.file), r = e.some((a) => a.ongoing);
  return {
    type: t.type,
    label: s.label,
    color: s.color,
    start: t.start,
    end: i,
    id: t.id,
    file: o?.file,
    durMs: i - t.start,
    ongoing: r || void 0,
    members: e
  };
}
function Re(e, t, i) {
  const s = e.map((r) => ({ start: r.start - t, end: r.end + i })).filter((r) => r.end > r.start).sort((r, a) => r.start - a.start), o = [];
  for (const r of s) {
    const a = o[o.length - 1];
    a && r.start <= a.end ? a.end = Math.max(a.end, r.end) : o.push({ ...r });
  }
  return o;
}
const Li = 6e4, Oi = 15e3;
class De {
  // in-flight fetches (cancelable)
  /** @param onLoaded called after each thumbnail resolves, to trigger a redraw. */
  constructor(t, i) {
    this._maxConcurrent = t, this._onLoaded = i, this._cache = /* @__PURE__ */ new Map(), this._loading = /* @__PURE__ */ new Set(), this._queue = [], this._active = 0, this._nvrId = "", this._cameraId = "", this._maxCache = 600, this._failed = /* @__PURE__ */ new Map(), this._gaps = [], this._controllers = /* @__PURE__ */ new Set();
  }
  configure(t, i, s, o) {
    this._hass = t, this._nvrId = i, this._cameraId = s, o && o > 0 && (this._maxConcurrent = o);
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
    if (ze(this._gaps, t.start)) return;
    const o = this._failed.get(i);
    o !== void 0 && Date.now() - o < Li || !this._loading.has(i) && this._hass && this._nvrId && this._cameraId && (this._loading.add(i), this._queue.push(t), this._drain());
  }
  _store(t, i) {
    if (this._cache.set(t, i), this._cache.size > this._maxCache) {
      const s = this._cache.keys().next().value;
      if (s !== void 0) {
        const o = this._cache.get(s);
        this._cache.delete(s), o && URL.revokeObjectURL(o);
      }
    }
  }
  _drain() {
    for (; this._active < this._maxConcurrent && this._queue.length; ) {
      const t = this._queue.shift(), i = this._key(t);
      this._active++;
      const s = t.camera ?? this._cameraId, o = Te(this._nvrId, s, t.start, { width: 320 }), r = new AbortController();
      this._controllers.add(r);
      const a = setTimeout(() => r.abort(), Oi);
      Pe(this._hass, o, 600).then((n) => fetch(n, { signal: r.signal })).then((n) => n.ok ? n.blob() : Promise.reject(new Error(`HTTP ${n.status}`))).then((n) => {
        this._store(i, URL.createObjectURL(n)), this._failed.delete(i);
      }).catch(() => {
        this._failed.set(i, Date.now());
      }).finally(() => {
        clearTimeout(a), this._controllers.delete(r), this._active--, this._loading.delete(i), this._drain(), this._onLoaded();
      });
    }
  }
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ii = { CHILD: 2 }, Le = (e) => (...t) => ({ _$litDirective$: e, values: t });
let Oe = class {
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
const { I: Bi } = ai, le = (e) => e, he = () => document.createComment(""), dt = (e, t, i) => {
  const s = e._$AA.parentNode, o = t === void 0 ? e._$AB : t._$AA;
  if (i === void 0) {
    const r = s.insertBefore(he(), o), a = s.insertBefore(he(), o);
    i = new Bi(r, a, e, e.options);
  } else {
    const r = i._$AB.nextSibling, a = i._$AM, n = a !== e;
    if (n) {
      let l;
      i._$AQ?.(e), i._$AM = e, i._$AP !== void 0 && (l = e._$AU) !== a._$AU && i._$AP(l);
    }
    if (r !== o || n) {
      let l = i._$AA;
      for (; l !== r; ) {
        const p = le(l).nextSibling;
        le(s).insertBefore(l, o), l = p;
      }
    }
  }
  return i;
}, J = (e, t, i = e) => (e._$AI(t, i), e), Vi = {}, Ie = (e, t = Vi) => e._$AH = t, Ni = (e) => e._$AH, Mt = (e) => {
  e._$AR(), e._$AA.remove();
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ce = (e, t, i) => {
  const s = /* @__PURE__ */ new Map();
  for (let o = t; o <= i; o++) s.set(e[o], o);
  return s;
}, jt = Le(class extends Oe {
  constructor(e) {
    if (super(e), e.type !== Ii.CHILD) throw Error("repeat() can only be used in text expressions");
  }
  dt(e, t, i) {
    let s;
    i === void 0 ? i = t : t !== void 0 && (s = t);
    const o = [], r = [];
    let a = 0;
    for (const n of e) o[a] = s ? s(n, a) : a, r[a] = i(n, a), a++;
    return { values: r, keys: o };
  }
  render(e, t, i) {
    return this.dt(e, t, i).values;
  }
  update(e, [t, i, s]) {
    const o = Ni(e), { values: r, keys: a } = this.dt(t, i, s);
    if (!Array.isArray(o)) return this.ut = a, r;
    const n = this.ut ??= [], l = [];
    let p, _, d = 0, g = o.length - 1, b = 0, x = r.length - 1;
    for (; d <= g && b <= x; ) if (o[d] === null) d++;
    else if (o[g] === null) g--;
    else if (n[d] === a[b]) l[b] = J(o[d], r[b]), d++, b++;
    else if (n[g] === a[x]) l[x] = J(o[g], r[x]), g--, x--;
    else if (n[d] === a[x]) l[x] = J(o[d], r[x]), dt(e, l[x + 1], o[d]), d++, x--;
    else if (n[g] === a[b]) l[b] = J(o[g], r[b]), dt(e, o[d], o[g]), g--, b++;
    else if (p === void 0 && (p = ce(a, b, x), _ = ce(n, d, g)), p.has(n[d])) if (p.has(n[g])) {
      const F = _.get(a[b]), H = F !== void 0 ? o[F] : null;
      if (H === null) {
        const q = dt(e, o[d]);
        J(q, r[b]), l[b] = q;
      } else l[b] = J(H, r[b]), dt(e, o[d], H), o[F] = null;
      b++;
    } else Mt(o[g]), g--;
    else Mt(o[d]), d++;
    for (; b <= x; ) {
      const F = dt(e, l[x + 1]);
      J(F, r[b]), l[b++] = F;
    }
    for (; d <= g; ) {
      const F = o[d++];
      F !== null && Mt(F);
    }
    return this.ut = a, Ie(e, l), et;
  }
});
var Ui = Object.defineProperty, Wi = Object.getOwnPropertyDescriptor, y = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? Wi(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && Ui(t, i, o), o;
};
const Hi = 62, ji = 80, de = 86, pe = 98, at = 104, qi = 2, Gi = 6, Yi = 8, Xi = 8, Ki = 20, Zi = 12, zt = 5, Ji = 24, Qi = 5e3, ts = 80, es = 0.325, is = 20, ue = 4e3, ss = 120, _e = 48, yt = 520;
function Ft(e) {
  return e.id ?? `${e.type}@${e.start}`;
}
function Be() {
  const e = (t) => {
    t.stopPropagation(), t.preventDefault();
  };
  window.addEventListener("pointerup", e, { capture: !0, once: !0 }), window.addEventListener("click", e, { capture: !0, once: !0 }), setTimeout(() => {
    window.removeEventListener("pointerup", e, !0), window.removeEventListener("click", e, !0);
  }, 700);
}
function os(e, t) {
  const i = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(e.trim());
  if (!i) return "";
  const s = i[1].length === 3 ? i[1].split("").map((a) => a + a).join("") : i[1], o = parseInt(s, 16), r = [o >> 16 & 255, o >> 8 & 255, o & 255].map((a) => Math.round(a * t));
  return `rgb(${r[0]}, ${r[1]}, ${r[2]})`;
}
function rs(e) {
  const t = it, i = Ee;
  return e <= 5 * t ? { major: 1 * t, minor: 15 * i } : e <= 10 * t ? { major: 1 * t, minor: 30 * i } : e <= 20 * t ? { major: 2 * t, minor: 30 * i } : e <= 40 * t ? { major: 5 * t, minor: 1 * t } : e <= 80 * t ? { major: 10 * t, minor: 1 * t } : { major: 10 * t, minor: 1 * t };
}
let w = class extends j {
  constructor() {
    super(...arguments), this.bands = [], this.gaps = [], this.gapColor = "", this.now = Date.now(), this.nvrId = "", this.cameraId = "", this.fontSize = 11, this.fontColor = "", this.accentColor = "", this.tickColor = "", this.tickSize = 7, this.recordedColor = "", this.futureColor = "", this.thumbSize = 79, this.thumbSizeActive = 95, this.thumbVersion = 0, this.live = !1, this.livePaused = !1, this.indent = 0, this.pillIndent = 0, this.mirror = !1, this.zoomUi = !0, this.rotated = !1, this.liveArrow = !1, this.compact = !1, this.playheadFrac = At, this.gutter = 0, this._zoomOpen = !1, this._dpr = 1, this._width = 0, this._height = 0, this._setupTs = 0, this._frame = 0, this._evtAnchor = at, this._hits = [], this._gapHits = [], this._animRaf = 0, this._pointers = /* @__PURE__ */ new Map(), this._dragStartY = 0, this._moved = !1, this._gestureStarted = !1, this._gestureScrubbed = !1, this._velSamples = [], this._scrubOpen = !1, this._pillBig = !1, this._glideBig = !1, this._momentumRaf = 0, this._momentumV = 0, this._momentumLast = 0, this._seekRaf = 0, this._onPointerDown = (e) => {
      const t = this._scrubEl;
      try {
        t.setPointerCapture(e.pointerId);
      } catch {
      }
      this._refreshRect(), this._cancelMomentum(), this._cancelSeek(), this._velSamples = [], this._gestureScrubbed = !1, this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }), this._moved = !1, this._hoverBand = void 0, this._hoverGap = void 0, this._pointers.size === 1 && (this._dragStartY = this._localY(e), this._dragStartDomain = { ...this.domain }, this._gestureStarted = !1);
    }, this._onPointerMove = (e) => {
      if (this._pointers.size === 0) {
        this._updateHover(e);
        return;
      }
      if (!this._pointers.has(e.pointerId) || (this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }), this._pointers.size !== 1 || !this._dragStartDomain)) return;
      const t = this._localY(e), i = t - this._dragStartY;
      Math.abs(i) > 2 && (this._moved = !0), this._moved && !this._gestureStarted && (this._gestureStarted = !0, this._scrubOpen = !0, this._syncPillBig(), this.dispatchEvent(new CustomEvent("scrub-start", { bubbles: !0, composed: !0 })));
      const s = performance.now();
      for (this._velSamples.push({ t: s, y: t }); this._velSamples.length > 1 && s - this._velSamples[0].t > ss; )
        this._velSamples.shift();
      const o = M(this._dragStartDomain), r = i / (this._height || 1) * o;
      let a = {
        start: this._dragStartDomain.start + r,
        end: this._dragStartDomain.end + r
      };
      const n = this._height || 1, l = C(a, this.playheadFrac) - this.now;
      if (l > 0) {
        const p = l / o * n, d = _e * p / (p + _e) / n * o, g = l - d;
        if (a = { start: a.start - g, end: a.end - g }, this._setDomain(a, d), !this._gestureScrubbed) return;
      } else
        this._setDomain(a), this._gestureScrubbed = !0;
      this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: Math.min(C(this.domain, this.playheadFrac), this.now) },
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
        if (C(this.domain, this.playheadFrac) > this.now && this._animateFrom({ ...this.domain }, this._applyDomain(N(this.now, M(this.domain), this.playheadFrac))), !this._gestureScrubbed) {
          this._velSamples = [], this._scrubOpen = !1, this._syncPillBig(), this.dispatchEvent(new CustomEvent("scrub-cancel", { bubbles: !0, composed: !0 }));
          return;
        }
        const i = this._releaseVelocity();
        if (!t && Math.abs(i) >= ts) {
          this._startMomentum(i);
          return;
        }
        this._emitScrubEnd();
      }
    }, this._onPointerLeave = () => {
      this._pointers.size === 0 && (this._clearHover(), this._hoverGap = void 0);
    }, this._onWheel = (e) => {
      e.preventDefault(), this._cancelMomentum(), this._cancelSeek();
      const t = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, i = C(this.domain, this.playheadFrac);
      this._panByPixels(-t), !(t < 0 && i >= this.now - 50 && !this._scrubEndTimer) && (this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: Math.min(C(this.domain, this.playheadFrac), this.now) },
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
      t && e.composedPath().includes(t) || (e.preventDefault(), e.stopPropagation(), Be(), this._closeZoom());
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
    e && (e.removeEventListener("pointerdown", this._onPointerDown), e.removeEventListener("pointermove", this._onPointerMove), e.removeEventListener("pointerup", this._onPointerUp), e.removeEventListener("pointercancel", this._onPointerUp), e.removeEventListener("pointerleave", this._onPointerLeave), e.removeEventListener("wheel", this._onWheel)), this._ro?.disconnect(), cancelAnimationFrame(this._frame), cancelAnimationFrame(this._animRaf), this._cancelMomentum(), this._cancelSeek(), window.removeEventListener("pointerdown", this._outsideZoomClose, !0);
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
    e && (e.removeEventListener("pointerdown", this._onPointerDown), e.removeEventListener("pointermove", this._onPointerMove), e.removeEventListener("pointerup", this._onPointerUp), e.removeEventListener("pointercancel", this._onPointerUp), e.removeEventListener("pointerleave", this._onPointerLeave), e.removeEventListener("wheel", this._onWheel), e.addEventListener("pointerdown", this._onPointerDown), e.addEventListener("pointermove", this._onPointerMove), e.addEventListener("pointerup", this._onPointerUp), e.addEventListener("pointercancel", this._onPointerUp), e.addEventListener("pointerleave", this._onPointerLeave), e.addEventListener("wheel", this._onWheel, { passive: !1 }));
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
      const o = i.dataset.key, r = this._kept.find((a) => Ft(a.m) === o);
      if (r) return r;
    }
  }
  _nearestEvent(e) {
    let t, i = 1 / 0;
    for (const s of this._hits) {
      const o = e < s.yTop ? s.yTop - e : e > s.yBot ? e - s.yBot : 0;
      o < i && (i = o, t = s);
    }
    return t ? { hit: t, dist: i } : void 0;
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
    this._momentumV = Math.max(-ue, Math.min(ue, e)), this._momentumLast = performance.now();
    const t = (i) => {
      const s = Math.min(0.1, (i - this._momentumLast) / 1e3);
      this._momentumLast = i, this._panByPixels(this._momentumV * s), this._draw(), this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: C(this.domain, this.playheadFrac) },
          bubbles: !0,
          composed: !0
        })
      ), this._momentumV *= Math.exp(-s / es);
      const o = this._momentumV > 0 && C(this.domain, this.playheadFrac) >= this.now - 250;
      if (Math.abs(this._momentumV) < is || o) {
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
    const t = C(this.domain, this.playheadFrac), i = Math.min(e, this.now);
    this._scrubOpen = !0, this._syncPillBig(), this.dispatchEvent(new CustomEvent("scrub-start", { bubbles: !0, composed: !0 }));
    const s = performance.now(), o = (r) => {
      const a = Math.min(1, (r - s) / yt), n = 1 - Math.pow(1 - a, 3);
      if (this._applyDomain(N(t + (i - t) * n, M(this.domain), this.playheadFrac)), this._draw(), this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: Math.min(C(this.domain, this.playheadFrac), this.now) },
          bubbles: !0,
          composed: !0
        })
      ), a < 1) {
        this._seekRaf = requestAnimationFrame(o);
        return;
      }
      this._seekRaf = 0, this._emitScrubEnd();
    };
    this._seekRaf = requestAnimationFrame(o);
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
    const t = this._localY(e), i = this._nearestEvent(t), s = i && i.dist <= Ji ? i.hit.band : void 0, o = s ? this._nearestKeptMember(s, this._yToTime(t)) : void 0;
    if (o) {
      this._setHover(o), this._hoverGap && (this._hoverGap = void 0);
      return;
    }
    this._hoverBand && this._clearHover(), this._updateGapHover(t);
  }
  /** The group's kept (visible) member nearest to time t, if any. */
  _nearestKeptMember(e, t) {
    let i, s = 1 / 0;
    for (const o of this._kept) {
      if (o.g !== e) continue;
      const r = t < o.m.start ? o.m.start - t : t > o.m.end ? t - o.m.end : 0;
      r < s && (s = r, i = o.m);
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
    const t = Si(M(this.domain), e);
    this._setSpan(t);
  }
  _setSpan(e) {
    this.dispatchEvent(new CustomEvent("zoom-change", { bubbles: !0, composed: !0 })), this._cancelMomentum(), this._cancelSeek();
    const t = this._animDomain ?? { ...this.domain }, i = this._applyDomain(N(C(this.domain, this.playheadFrac), e, this.playheadFrac));
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
    const s = performance.now(), o = (r) => {
      const a = Math.min(1, (r - s) / i), n = 1 - Math.pow(1 - a, 3);
      this._animDomain = {
        start: e.start + (t.start - e.start) * n,
        end: e.end + (t.end - e.end) * n
      }, this._draw(), this.requestUpdate(), a < 1 ? this._animRaf = requestAnimationFrame(o) : (this._animDomain = void 0, this._draw(), this.requestUpdate());
    };
    this._animRaf = requestAnimationFrame(o);
  }
  // Slider value 0..N-1 maps 0=zoomed-out (widest span) -> N-1=zoomed-in.
  get _sliderValue() {
    const e = M(this.domain);
    let t = 0, i = 1 / 0;
    return O.forEach((s, o) => {
      const r = Math.abs(s - e);
      r < i && (i = r, t = o);
    }), O.length - 1 - t;
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
    const i = t.getBoundingClientRect(), s = 8, o = this.rotated ? i.width : i.height, r = this.rotated ? i.right - e.clientX : e.clientY - i.top, a = Math.max(1, o - s * 2), n = Math.min(1, Math.max(0, (r - s) / a)), l = Math.round((1 - n) * (O.length - 1));
    l !== this._sliderValue && this._setSpan(O[O.length - 1 - l]);
  }
  /** Commit a domain (clamped so the playhead can't pass `now` — plus an
   *  optional allowance for the rubber-band overshoot); no redraw. */
  _applyDomain(e, t = 0) {
    const i = C(e, this.playheadFrac);
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
        detail: { time: Math.min(C(this.domain, this.playheadFrac), this.now) },
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
    const o = this._height;
    if (this._width = i, this._height = s, this._rect = t, this._dpr = window.devicePixelRatio || 1, performance.now() - this._setupTs > 500 && o > 0 && this.domain && Math.abs(s - o) > 0.5) {
      const a = M(this.domain) * (s / o), l = C(this.domain, this.playheadFrac) + a * this.playheadFrac;
      this._applyDomain({ start: l - a, end: l });
    }
    e.width = Math.max(1, Math.round(i * this._dpr)), e.height = Math.max(1, Math.round(s * this._dpr)), this._draw(), o !== this._height && this.requestUpdate();
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
        labelRight: Hi,
        tickRight: ji,
        trackX0: de,
        trackX1: pe,
        evtAnchor: at
      };
    const t = this._width || 1, i = Math.max(2, Math.min(this.tickSize + 5, 18)), s = t - qi, o = s - i - Gi, r = pe - de, a = Math.max(r, o - e - Yi), n = a - r;
    return { labelRight: o, tickRight: s, trackX0: n, trackX1: a, evtAnchor: t - n + Xi };
  }
  _draw() {
    const e = this._canvas;
    if (!e || !this.domain) return;
    const t = e.getContext("2d");
    if (!t) return;
    const i = this._width, s = this._height;
    t.setTransform(this._dpr, 0, 0, this._dpr, 0, 0), t.clearRect(0, 0, i, s), this.indent && t.translate(this.indent, 0);
    const o = getComputedStyle(this), r = o.getPropertyValue("--secondary-text-color").trim() || "#9aa0a6", a = o.getPropertyValue("--divider-color").trim() || "rgba(255,255,255,0.12)", n = this.accentColor || o.getPropertyValue("--primary-color").trim() || "#03a9f4", l = this.fontSize || 11, p = o.fontFamily || "sans-serif";
    t.font = `${l}px ${p}`;
    const _ = this._geo(
      this.mirror ? t.measureText(this._fmt(this._dd.end, { hour: "2-digit", minute: "2-digit" })).width : 0
    );
    this._evtAnchor !== _.evtAnchor && (this._evtAnchor = _.evtAnchor, this.requestUpdate());
    const d = this.recordedColor || a, g = Math.max(0, Math.min(this._timeToY(this.now), s)), b = _.trackX1 - _.trackX0;
    if (g > 0 && (this._roundRect(t, _.trackX0, 0, b, g, 3), this.futureColor ? (t.fillStyle = this.futureColor, t.globalAlpha = 1) : (t.fillStyle = d, t.globalAlpha = 0.7), t.fill(), t.globalAlpha = 1), g < s && (this._roundRect(t, _.trackX0, g, b, s - g, 3), t.fillStyle = d, t.fill()), this._gapHits = [], this.gaps && this.gaps.length) {
      const V = this.gapColor || "#4a4a52";
      t.fillStyle = V, t.globalAlpha = 1;
      for (const S of this.gaps) {
        let R = this._timeToY(S.end), G = this._timeToY(S.start);
        if (!(G < 0 || R > s)) {
          if (G - R < 3) {
            const K = (R + G) / 2;
            R = K - 1.5, G = K + 1.5;
          }
          this._roundRect(t, _.trackX0, R, b, G - R, 3), t.fill(), this._gapHits.push({ gap: S, yTop: R, yBot: G });
        }
      }
    }
    const { major: x, minor: F } = rs(M(this._dd)), H = this.tickColor || r, q = Math.max(2, Math.min(this.tickSize, 16)), $ = Math.max(2, Math.min(this.tickSize + 5, 18)), B = Math.max(1, Math.min(this.tickSize / 5, 2.5));
    t.strokeStyle = H, t.lineWidth = B, t.globalAlpha = 0.7;
    for (const V of re(this._dd, F)) {
      const S = this._timeToY(V);
      S < 4 || S > s - 4 || (t.beginPath(), t.moveTo(_.tickRight - q, S), t.lineTo(_.tickRight, S), t.stroke());
    }
    t.globalAlpha = 1, t.lineWidth = 1, t.textBaseline = "middle", t.textAlign = "right";
    const Y = l * 0.55;
    for (const V of re(this._dd, x)) {
      const S = this._timeToY(V);
      S < Y || S > s - Y || (t.strokeStyle = H, t.lineWidth = Math.max(B, 1.5), t.globalAlpha = 0.95, t.beginPath(), t.moveTo(_.tickRight - $, S), t.lineTo(_.tickRight, S), t.stroke(), t.globalAlpha = 1, t.lineWidth = 1, t.fillStyle = this.fontColor || r, t.fillText(this._fmt(V, { hour: "2-digit", minute: "2-digit" }), _.labelRight, S));
    }
    this._hits = [];
    const vt = b;
    for (const V of this.bands) {
      let S = this._timeToY(V.end), R = this._timeToY(V.start);
      if (R < 0 || S > s) continue;
      if (R - S < zt) {
        const K = (S + R) / 2;
        S = K - zt / 2, R = K + zt / 2;
      }
      this._hits.push({ band: V, colX: _.trackX1, yTop: S, yBot: R }), t.fillStyle = n;
      const G = Math.min(vt / 2, (R - S) / 2);
      t.beginPath(), t.roundRect(_.trackX0, S, vt, R - S, G), t.fill();
    }
    t.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    const bt = this._playheadY, ht = this.mirror ? Math.max(0, _.trackX0 - 6) : 0;
    t.fillStyle = n, t.globalAlpha = 0.18, t.fillRect(ht, bt - 6, i - ht, 12), t.globalAlpha = 1, t.strokeStyle = n, t.lineWidth = 3, t.beginPath(), t.moveTo(ht, bt), t.lineTo(i, bt), t.stroke(), t.lineWidth = 1;
  }
  _roundRect(e, t, i, s, o, r) {
    const a = Math.max(0, Math.min(r, s / 2, o / 2));
    e.beginPath(), e.moveTo(t + a, i), e.arcTo(t + s, i, t + s, i + o, a), e.arcTo(t + s, i + o, t, i + o, a), e.arcTo(t, i + o, t, i, a), e.arcTo(t, i, t + s, i, a), e.closePath();
  }
  _fmt(e, t) {
    return new Intl.DateTimeFormat(void 0, t).format(new Date(e));
  }
  render() {
    const e = this.accentColor || "var(--primary-color, #03a9f4)", t = os(this.accentColor, 0.58), i = this.gutter ? -(this.gutter / 2 + (this.compact ? 19 : 22)) : 8, s = this.live && !this.livePaused && this.domain && this.now - C(this.domain, this.playheadFrac) < Qi, o = !s && this.domain ? this._fmt(Math.min(C(this.domain, this.playheadFrac), this.now), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }) : "", r = this._height > 0 && (s || !!o), a = `--upc-thumb-w:${this.thumbSize}px;--upc-thumb-w-lg:${this.thumbSizeActive}px;`, n = 1 - this._sliderValue / (O.length - 1), l = this._renderThumbs(), p = this._evtAnchor + Ki + (this._pillDodge() ? this.thumbSizeActive + Zi : 0);
    return c`
      <div
        class="col"
        style="--upc-accent:${e};${t ? `--upc-accent-deep:${t};` : ""}--upc-indent:${this.indent}px;--upc-pill-left:${this.pillIndent}px;--upc-evt-right:${this._evtAnchor}px;--upc-pill-right:${p}px;--upc-fab-right:${i}px;--upc-ph-y:${this._height * this.playheadFrac}px;${a}"
      >
        <div class="scrub">
          <canvas></canvas>
          <div class="evt-layer">${l}</div>
          ${r ? c`<div
                class="live-pill ${s ? "" : "at-time"} ${this._pillBig ? "big" : ""}"
                style="top:${this._height * this.playheadFrac}px"
              >
                ${s ? "LIVE" : o}
              </div>` : v}
          ${this._hoverGap ? c`<div class="gap-tip" style="top:${this._hoverGap.y}px">
                Camera offline
                <div class="gap-sub">
                  ${this._fmt(this._hoverGap.gap.start, { hour: "2-digit", minute: "2-digit" })} –
                  ${this._fmt(this._hoverGap.gap.end, { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>` : v}
          ${this.zoomUi ? this._renderZoom(n) : v}
          ${this.liveArrow && !this.live ? c`<button
                class="live-arrow"
                title="Jump to live"
                @pointerdown=${(_) => _.stopPropagation()}
                @click=${this._goLive}
              >
                ↑
              </button>` : v}
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
    return c`
      ${this._zoomOpen ? c`<div class="zoom-panel">
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
          </div>` : c`<button
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
    if (!this._height || !this.domain) return v;
    const e = C(this.domain, this.playheadFrac), t = this.thumbSizeActive * 0.75 / 2, i = this.thumbSize * 0.75 / 2, s = t + i + 6, o = [];
    let r = 1 / 0;
    for (const { m: p, g: _ } of this._members()) {
      const d = (this._timeToY(p.end) + this._timeToY(p.start)) / 2;
      r - d < s || (r = d, o.push({ m: p, g: _, y: d }));
    }
    this._kept = o;
    let a, n = 1 / 0;
    for (const p of o) {
      if (e < p.g.start || e > p.g.end) continue;
      const _ = e < p.m.start ? p.m.start - e : e > p.m.end ? e - p.m.end : 0;
      _ < n && (n = _, a = p);
    }
    const l = o.filter((p) => {
      const _ = p === a || this._hoverBand === p.m ? t : i;
      return p.y + _ >= 0 && p.y - _ <= this._height;
    });
    return jt(
      l,
      (p) => Ft(p.m),
      (p) => {
        const _ = p === a, d = this._hoverBand === p.m, g = this.loader?.get(p.m);
        return c`<div
          class="evt ${_ ? "active" : ""} ${d ? "hovered" : ""}"
          style="top:${p.y}px"
        >
          <span class="evt-line"></span>
          <div
            class="evt-wrap"
            data-key=${Ft(p.m)}
            @mouseenter=${() => this._setHover(p.m)}
            @mouseleave=${this._clearHover}
          >
            ${g ? c`<img class="evt-thumb" .src=${g} alt=${p.g.label} />` : c`<span class="evt-thumb evt-ph"></span>`}
          </div>
        </div>`;
      }
    );
  }
};
w.styles = st`
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
y([
  h({ attribute: !1 })
], w.prototype, "domain", 2);
y([
  h({ attribute: !1 })
], w.prototype, "bands", 2);
y([
  h({ attribute: !1 })
], w.prototype, "gaps", 2);
y([
  h()
], w.prototype, "gapColor", 2);
y([
  h({ attribute: !1 })
], w.prototype, "now", 2);
y([
  h({ attribute: !1 })
], w.prototype, "hass", 2);
y([
  h()
], w.prototype, "nvrId", 2);
y([
  h()
], w.prototype, "cameraId", 2);
y([
  h({ type: Number })
], w.prototype, "fontSize", 2);
y([
  h()
], w.prototype, "fontColor", 2);
y([
  h()
], w.prototype, "accentColor", 2);
y([
  h()
], w.prototype, "tickColor", 2);
y([
  h({ type: Number })
], w.prototype, "tickSize", 2);
y([
  h()
], w.prototype, "recordedColor", 2);
y([
  h()
], w.prototype, "futureColor", 2);
y([
  h({ type: Number })
], w.prototype, "thumbSize", 2);
y([
  h({ type: Number })
], w.prototype, "thumbSizeActive", 2);
y([
  h({ attribute: !1 })
], w.prototype, "loader", 2);
y([
  h({ type: Number })
], w.prototype, "thumbVersion", 2);
y([
  h({ type: Boolean })
], w.prototype, "live", 2);
y([
  h({ type: Boolean })
], w.prototype, "livePaused", 2);
y([
  h({ type: Number })
], w.prototype, "indent", 2);
y([
  h({ type: Number })
], w.prototype, "pillIndent", 2);
y([
  h({ type: Boolean, reflect: !0 })
], w.prototype, "mirror", 2);
y([
  h({ type: Boolean })
], w.prototype, "zoomUi", 2);
y([
  h({ type: Boolean })
], w.prototype, "rotated", 2);
y([
  h({ type: Boolean })
], w.prototype, "liveArrow", 2);
y([
  h({ type: Boolean, reflect: !0 })
], w.prototype, "compact", 2);
y([
  h({ type: Number })
], w.prototype, "playheadFrac", 2);
y([
  h({ type: Number })
], w.prototype, "gutter", 2);
y([
  f()
], w.prototype, "_hoverBand", 2);
y([
  f()
], w.prototype, "_hoverGap", 2);
y([
  f()
], w.prototype, "_zoomOpen", 2);
y([
  U("canvas")
], w.prototype, "_canvas", 2);
y([
  U(".scrub")
], w.prototype, "_scrubEl", 2);
y([
  f()
], w.prototype, "_pillBig", 2);
w = y([
  ot("upc-scrubber-timeline")
], w);
var as = Object.defineProperty, ns = Object.getOwnPropertyDescriptor, E = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? ns(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && as(t, i, o), o;
};
let P = class extends j {
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
      const o = this._bandByKey.get(s);
      o && this.loader?.get(o), this._io?.unobserve(i.target), t = !0;
    }
    t && this.requestUpdate();
  }
  _observeRows() {
    this._io && this.renderRoot.querySelectorAll(".thumb[data-key]").forEach((e) => {
      const t = e.dataset.key;
      this._requested.has(t) || this._io.observe(e);
    });
  }
  _fmtTime(e) {
    return new Intl.DateTimeFormat(void 0, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(e));
  }
  _fmtDay(e) {
    return new Intl.DateTimeFormat(void 0, {
      weekday: "short",
      month: "short",
      day: "numeric"
    }).format(new Date(e));
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
  scrollToDay(e) {
    const t = e + 864e5, i = [...this.bands].sort((n, l) => l.start - n.start).find((n) => n.start < t);
    if (!i || !this._listEl) return;
    const o = this.renderRoot.querySelector(`.thumb[data-key="${i.type}@${i.start}"]`)?.closest(".row");
    if (!o) return;
    const r = o.previousElementSibling, a = r?.classList.contains("day-divider") ? r : o;
    this._listEl.scrollTop = a.offsetTop;
  }
  render() {
    const e = [...this.bands].sort((i, s) => s.start - i.start), t = `--list-size:${this.textSize}px;--list-dur-size:${this.durationSize}px;--list-active-size:${this.activeTextSize}px;--list-active-dur-size:${this.activeDurationSize}px;--list-active-color:${this.activeTextColor};--list-active-dur-color:${this.activeDurationColor};--list-active-bg:${this.activeBg};--list-thumb-w:${this.thumbWidth}px;` + (this.dividerColor ? `--upc-divider:${this.dividerColor};` : "") + (this.textColor ? `--list-color:${this.textColor};` : "") + (this.durationColor ? `--list-dur-color:${this.durationColor};--list-dur-op:1;` : "");
    return this._bandByKey.clear(), c`
      <div class="list" style=${t}>
        ${e.length === 0 ? c`<div class="empty">No events in this range</div>` : jt(
      e,
      (i) => `${i.type}@${i.start}`,
      (i, s) => {
        const o = `${i.type}@${i.start}`;
        this._bandByKey.set(o, i);
        const r = this._requested.has(o) ? this.loader?.get(i) : void 0, a = this.playingKey === o, n = i.ongoing ? "In progress" : this._fmtDur(i.durMs ?? i.end - i.start), l = this.showCamera && !!i.cameraName, p = l ? i.cameraName : this._fmtTime(i.start), _ = l ? `${this._fmtTime(i.start)} · ${n}` : n, d = s === 0 || !this._sameDay(e[s - 1].start, i.start);
        return c`
                  ${d ? c`<div class="day-divider">
                        <span
                          class="day-label"
                          style="font-size:${this.dateFontSize}px;color:${this.dateFontColor || "#fff"}"
                          >${this._fmtDay(i.start)}</span
                        >
                      </div>` : v}
                  <button class="row ${a ? "playing" : ""}" @click=${() => this._play(i)}>
                    <div class="info">
                      <div class="t1">${p}</div>
                      <div class="t2">${_}</div>
                    </div>
                    <div class="thumb" data-key=${o}>
                      ${r ? c`<img src=${r} alt=${i.label} />` : c`<span class="ph"></span>`}
                    </div>
                  </button>
                `;
      }
    )}
      </div>
    `;
  }
};
P.styles = st`
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
E([
  h({ attribute: !1 })
], P.prototype, "bands", 2);
E([
  h({ attribute: !1 })
], P.prototype, "loader", 2);
E([
  h({ type: Number })
], P.prototype, "thumbVersion", 2);
E([
  h({ type: Number })
], P.prototype, "textSize", 2);
E([
  h()
], P.prototype, "textColor", 2);
E([
  h({ type: Number })
], P.prototype, "durationSize", 2);
E([
  h()
], P.prototype, "durationColor", 2);
E([
  h({ type: Number })
], P.prototype, "activeTextSize", 2);
E([
  h()
], P.prototype, "activeTextColor", 2);
E([
  h({ type: Number })
], P.prototype, "activeDurationSize", 2);
E([
  h()
], P.prototype, "activeDurationColor", 2);
E([
  h()
], P.prototype, "activeBg", 2);
E([
  h()
], P.prototype, "playingKey", 2);
E([
  h({ type: Number })
], P.prototype, "dateFontSize", 2);
E([
  h()
], P.prototype, "dateFontColor", 2);
E([
  h()
], P.prototype, "dividerColor", 2);
E([
  h({ type: Number })
], P.prototype, "thumbWidth", 2);
E([
  h({ type: Boolean, reflect: !0 })
], P.prototype, "showCamera", 2);
E([
  h({ type: Boolean, reflect: !0 })
], P.prototype, "line1White", 2);
E([
  U(".list")
], P.prototype, "_listEl", 2);
P = E([
  ot("upc-events-list")
], P);
const fe = 6e4, ls = 1e4, hs = 5e3, cs = 5e3, ds = 8e3, ps = 15e3, us = 400, _s = 15, fs = 25 * 6e4, ms = 5 * 6e4, gs = 16;
class vs {
  constructor() {
    this._dir = "", this._blocks = /* @__PURE__ */ new Set(), this._blockMs = 6e5, this._overview = /* @__PURE__ */ new Set(), this._overviewMs = 36e5, this._mapped = /* @__PURE__ */ new Set(), this._indexAt = 0, this._blobs = /* @__PURE__ */ new Map(), this._loading = /* @__PURE__ */ new Map(), this._maps = /* @__PURE__ */ new Map(), this._lastSync = 0, this._pinned = /* @__PURE__ */ new Set(), this._warnedNoHeadFile = !1, this._tipAt = 0, this._tipReqAt = 0, this._tipPolling = !1, this._tipEnabled = !1, this._mapLoading = /* @__PURE__ */ new Map();
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
    if (i < fe) {
      const s = this._head;
      s && t !== void 0 && t >= s.start && i >= ls && this._refreshIndex();
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
        const o = await s.json();
        if (Array.isArray(o.blocks)) {
          t = !0, this._blocks = new Set(o.blocks), this._mapped = new Set(o.maps ?? []), o.block_ms && o.block_ms > 0 && (this._blockMs = o.block_ms), this._overview = new Set(o.overview ?? []), o.overview_block_ms && o.overview_block_ms > 0 && (this._overviewMs = o.overview_block_ms);
          const r = o.head;
          this._head = r && typeof r.start == "number" && typeof r.end == "number" && r.end > r.start ? { start: r.start, end: r.end, map: !!r.map, file: r.file } : void 0, this._head && !this._head.file && !this._warnedNoHeadFile && (this._warnedNoHeadFile = !0, console.warn(
            "[unifi-protect-timeline-card] scrub preview: protect_scrub.py is out of date (head has no immutable `file`) — near-live preview disabled. Update the pyscript job."
          )), i = Date.now() - (o.generated ?? 0) > fs;
        }
      }
    } catch {
    }
    this._indexAt = t ? Date.now() : Date.now() - Math.max(0, fe - hs), i && this._requestSync();
  }
  /** Fire the pyscript sync service (throttled). No-ops when pyscript isn't
   *  installed — the card just keeps the plain black scrub stage. */
  _requestSync() {
    if (!this._hass) return;
    const t = Date.now();
    t - this._lastSync < ms || (this._lastSync = t, this._hass.callWS({ type: "call_service", domain: "pyscript", service: "protect_scrub_sync" }).catch(() => {
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
        mapped: this._mapped.has(i)
      };
    const s = this._head;
    if (s && s.file && t >= s.start) {
      const o = this._headHeld;
      return o && o.start === s.start && t <= o.end && this._blobs.has(o.key) ? o : {
        // The filename carries the covered range, so it IS the identity.
        key: s.file,
        start: s.start,
        end: s.end,
        url: `${this._dir}/${s.file}`,
        head: !0,
        mapped: !!s.map
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
    t - this._tipReqAt < ds || this._tip && this._tip.end > t - ps || (this._tipReqAt = t, this._hass.callWS({
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
        for (let i = 0; i < _s; i++) {
          if (await new Promise((s) => setTimeout(s, us)), !this._tipEnabled) return;
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
    !this._tipEnabled || !this._dir || Date.now() - this._tipAt < cs || await this._fetchTip();
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
    const o = {
      key: s.file,
      start: s.start,
      end: s.end,
      url: `${this._dir}/${s.file}`,
      tip: !0
    };
    if (this._blobs.has(o.key))
      return this._tipHeld = o, o;
    const r = this._tipHeld;
    return r && t >= r.start && this._blobs.has(r.key) && (t <= r.end || r.end > i) ? (this.getBlock(o).then((a) => {
      a && this.onTipUpdate?.();
    }), r) : o;
  }
  /** The head's advertised end, for tipBlockFor's freshness comparison. */
  headEnd() {
    return this._head?.end ?? 0;
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
        url: `${this._dir}/o${i}.mp4`
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
      const i = t.url.replace(/\.mp4$/, ".map.json"), s = await fetch(i, { cache: "no-cache" }), o = s.ok ? await s.json() : void 0;
      let r = null;
      return o?.version === 2 && Array.isArray(o.segments) && o.segments.length && (r = o.segments.filter((a) => typeof a?.f == "string" && a.e > a.s), r.length || (r = null)), this._maps.set(t.key, r), r ?? void 0;
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
    let o = 0;
    for (let r = 0; r < s.length && i >= s[r].s; r++)
      o = r;
    for (const r of [o - 1, o + 1])
      r >= 0 && r < s.length && this.getBlock(this._partBlock(t, s[r]));
    return this._partBlock(t, s[o]);
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
      const s = await i.blob(), o = URL.createObjectURL(s);
      for (this._blobs.set(t.key, o), t.head && !t.part && (this._headHeld = t); this._blobs.size > gs; ) {
        let r = !1;
        for (const [a, n] of this._blobs)
          if (!this._pinned.has(n)) {
            this._blobs.delete(a), URL.revokeObjectURL(n), r = !0;
            break;
          }
        if (!r) break;
      }
      return o;
    } catch {
      return;
    }
  }
}
function Dt(e) {
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
function Lt(e) {
  if (!e) return;
  e instanceof HTMLVideoElement && Dt(e);
  const t = (i) => {
    for (const s of Array.from(i.querySelectorAll("*")))
      s instanceof HTMLVideoElement && Dt(s), s.shadowRoot && t(s.shadowRoot);
  };
  t(e), "shadowRoot" in e && e.shadowRoot && t(e.shadowRoot);
}
var bs = Object.defineProperty, ws = Object.getOwnPropertyDescriptor, m = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? ws(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && bs(t, i, o), o;
};
const me = 5 * 6e4, ys = 12e3;
function ge(e) {
  return e?.name === "NotAllowedError";
}
let u = class extends j {
  constructor() {
    super(...arguments), this.nvrId = "", this.cameraId = "", this.gaps = [], this.footageSpans = [], this.targetTime = Date.now(), this.scrubbing = !1, this.live = !1, this.chunkSeconds = 300, this.now = Date.now(), this.previewDir = "", this.tipEnabled = !1, this.clipEndTime = 0, this.accent = "", this.delaySeconds = 15, this.stacked = !1, this.startFs = !1, this.fsTimeline = !1, this.fsTimelineWidth = 165, this.fsTimelineGrabWidth = 0, this.fsTimelinePadding = 100, this.fsTimelineGutter = 140, this.fsTimelineScrim = 0.88, this.fsTimelineScrimExtend = 170, this._loadingVideo = !1, this._streamReady = !1, this._followActive = null, this._followPaused = !1, this._followMuted = !0, this._tapToPlay = !1, this._followCtrl = !1, this._ctrlMode = "live", this._isFs = !1, this._forceRotate = !1, this._modalOn = !1, this._followRate = 1, this._nearLive = !1, this._livePausedState = !1, this._liveMuted = !1, this._clipPaused = !1, this._clipMuted = !1, this._clipRate = 1, this._clipProgress = 0, this._clipTime = 0, this._clipDuration = 0, this._preparing = !1, this._followToken = 0, this._followWatch = {
      a: void 0,
      b: void 0
    }, this._followWatchTries = { a: 0, b: 0 }, this._followMeta = {
      a: { start: 0, end: 0, ready: !1, leadIn: 0 },
      b: { start: 0, end: 0, ready: !1, leadIn: 0 }
    }, this._followPlayhead = 0, this._followSwapArmed = !1, this._preview = new vs(), this._previewActive = null, this._previewBlocks = {
      a: void 0,
      b: void 0
    }, this._previewPending = {
      a: void 0,
      b: void 0
    }, this._previewRetries = { a: 0, b: 0 }, this._previewToken = 0, this._videoToken = 0, this._clipStart = 0, this._autoplayDone = !1, this._hidden = !1, this._onTimeUpdate = () => {
      const e = this._video;
      if (!e) return;
      const t = this._clipStart + e.currentTime * 1e3;
      this.dispatchEvent(
        new CustomEvent("playback-time", { detail: { time: t }, bubbles: !0, composed: !0 })
      ), isFinite(e.duration) && e.duration > 0 && (this._clipProgress = e.currentTime / e.duration), this._clipTime = e.currentTime, isFinite(e.duration) && (this._clipDuration = e.duration);
    }, this._onSeekDown = (e) => {
      e.stopPropagation();
      const t = e.currentTarget;
      try {
        t.setPointerCapture(e.pointerId);
      } catch {
      }
      this._seekTo(e, t);
      const i = (o) => this._seekTo(o, t), s = () => {
        t.removeEventListener("pointermove", i), t.removeEventListener("pointerup", s), t.removeEventListener("pointercancel", s), this._showFollowCtrl();
      };
      t.addEventListener("pointermove", i), t.addEventListener("pointerup", s), t.addEventListener("pointercancel", s), this._showFollowCtrl();
    }, this._onEnded = () => {
      this.clipEndTime > 0 && this.dispatchEvent(new CustomEvent("clip-ended", { bubbles: !0, composed: !0 }));
    }, this._onVideoReady = () => {
      this._loadingVideo = !1;
      const e = this._video;
      e && (e.playbackRate = this._clipRate, !this._autoplayDone && (this._autoplayDone = !0, e.muted = this._clipMuted, e.play().catch(() => {
        this._clipMuted = !0, e.muted = !0, e.play().catch(() => {
        });
      })));
    }, this._onVideoError = () => {
      this._loadingVideo = !1, this._error = "Clip unavailable for this time range.";
    }, this._onTapToPlay = (e) => {
      e.stopPropagation(), this._tapToPlay = !1, this._followPaused = !1;
      const t = this._followActive ? this._followVideo(this._followActive) : this._video;
      t && this._playFollowVideo(t);
    }, this._frozen = !1, this._freezeRaf = 0, this._framePresented = !1, this._holdPoster = "", this._posterWarm = "", this._showFollowCtrl = () => {
      this._followCtrl = !0, clearTimeout(this._followCtrlTimer), !this.scrubbing && (this._followCtrlTimer = setTimeout(() => {
        this._followCtrl = !1;
      }, 5200));
    }, this._hideFollowCtrl = () => {
      clearTimeout(this._followCtrlTimer), this._followCtrl = !1, this._ctrlDismissedAt = Date.now();
    }, this._ctrlDismissedAt = 0, this._keepCtrlAlive = () => {
      this._followCtrl && this._showFollowCtrl();
    }, this._ctrlVisibleAtPress = !1, this._onStagePress = () => {
      this._ctrlVisibleAtPress = this._followCtrl;
    }, this._onStageTap = () => {
      this._ctrlVisibleAtPress ? this._hideFollowCtrl() : this._showFollowCtrl();
    }, this._onStripTap = (e) => {
      e.stopPropagation(), this._hideFollowCtrl();
    }, this._onStripBlankTap = (e) => {
      e.stopPropagation(), !(e.composedPath()[0] !== e.currentTarget || this.scrubbing) && this._hideFollowCtrl();
    }, this._toggleFollowPlay = (e) => {
      e.stopPropagation(), this._followPaused = !this._followPaused;
      const t = this._followActive ? this._followVideo(this._followActive) : void 0;
      this._followPaused ? t?.pause() : t?.play().catch(() => {
      }), this._showFollowCtrl();
    }, this._toggleFollowMute = (e) => {
      e.stopPropagation(), this._followMuted = !this._followMuted, [this._followVidA, this._followVidB].forEach((t) => {
        t && (t.muted = this._followMuted);
      }), this._showFollowCtrl();
    }, this._toggleFs = (e) => {
      if (e.stopPropagation(), this.stacked) {
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
      e.stopPropagation(), this._holdFrame(), this.dispatchEvent(
        new CustomEvent("rewind", {
          detail: { time: this.now - 15e3 },
          bubbles: !0,
          composed: !0
        })
      ), this._showFollowCtrl();
    }, this._toggleLivePlay = (e) => {
      e.stopPropagation();
      const t = this._liveVideo();
      t && (t.paused ? (this._livePausedState = !1, t.play().catch(() => {
      })) : (this._livePausedState = !0, t.pause()), this._showFollowCtrl());
    }, this._toggleLiveMute = (e) => {
      e.stopPropagation();
      const t = this._liveVideo();
      t && (this._liveMuted = !t.muted, t.muted = this._liveMuted, this._showFollowCtrl());
    }, this._clipSkipBack = (e) => {
      e.stopPropagation();
      const t = this._video;
      t && (t.currentTime = Math.max(0, t.currentTime - 15), this._announceSeek(this._clipStart + t.currentTime * 1e3)), this._showFollowCtrl();
    }, this._clipSkipFwd = (e) => {
      e.stopPropagation();
      const t = this._video;
      t && isFinite(t.duration) && (t.currentTime = Math.min(t.duration, t.currentTime + 15), this._announceSeek(this._clipStart + t.currentTime * 1e3)), this._showFollowCtrl();
    }, this._toggleClipPlay = (e) => {
      e.stopPropagation();
      const t = this._video;
      t && (t.paused ? t.play().catch(() => {
      }) : t.pause(), this._showFollowCtrl());
    }, this._toggleClipMute = (e) => {
      e.stopPropagation();
      const t = this._video;
      t && (this._clipMuted = !t.muted, t.muted = this._clipMuted, this._showFollowCtrl());
    }, this._toggleClipRate = (e) => {
      e.stopPropagation(), this._clipRate = this._clipRate === 1 ? 2 : this._clipRate === 2 ? 4 : 1;
      const t = this._video;
      t && (t.playbackRate = this._clipRate), this._showFollowCtrl();
    }, this._skipBack = (e) => {
      e.stopPropagation(), this._followSkip(-15e3);
    }, this._skipFwd = (e) => {
      if (e.stopPropagation(), this._followNearLive()) {
        this.dispatchEvent(new CustomEvent("go-live", { bubbles: !0, composed: !0 }));
        return;
      }
      this._followSkip(15e3);
    }, this._toggleFollowRate = (e) => {
      e.stopPropagation(), !this._followNearLive() && (this._followRate = this._followRate === 1 ? 2 : this._followRate === 2 ? 4 : 1, [this._followVidA, this._followVidB].forEach((t) => {
        t && (t.playbackRate = this._followRate);
      }), this._showFollowCtrl());
    };
  }
  // one unmuted-autoplay attempt per loaded clip
  /** Invalidate any in-flight segment load. Single-flight is enforced by the
   *  <video> element itself: replacing/clearing `src` makes the browser abort
   *  the streaming request, which cancels the export on the NVR side too.
   *  The clip's server-side session is released here too, so abandoning a clip
   *  frees its working directory immediately instead of waiting for the sweep. */
  _cancelLoad() {
    this._videoToken++, this._preparing = !1, this._endClipSession();
  }
  connectedCallback() {
    if (super.connectedCallback(), document.addEventListener("fullscreenchange", this._onFsChange), this.addEventListener("pointerdown", this._keepCtrlAlive, !0), this.addEventListener("pointermove", this._keepCtrlAlive, !0), this._visObserver = new IntersectionObserver(
      (e) => this._onHostVisibility(e[e.length - 1].isIntersecting),
      { threshold: 0 }
    ), this._visObserver.observe(this), customElements.get("ha-camera-stream"))
      this._streamReady = !0;
    else {
      const e = window.loadCardHelpers;
      e?.().then(() => {
        this._streamReady = !!customElements.get("ha-camera-stream");
      }), customElements.whenDefined("ha-camera-stream").then(() => {
        this._streamReady = !0;
      });
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback(), clearTimeout(this._hideTimer), clearTimeout(this._followCtrlTimer), this._releaseFrame(), document.removeEventListener("fullscreenchange", this._onFsChange), this.removeEventListener("pointerdown", this._keepCtrlAlive, !0), this.removeEventListener("pointermove", this._keepCtrlAlive, !0), this._visObserver?.disconnect(), this._visObserver = void 0, this._stopLivePoll(), this._cancelLoad(), this._stopFollow(), this._setClipSrc(), this._resetPreviewSlots(), this._preview.destroy(), Lt(this.renderRoot);
  }
  willUpdate(e) {
    if ((e.has("live") && !this.live || e.has("cameraId")) && Lt(this.renderRoot?.querySelector("ha-camera-stream")), e.has("cameraId") && (this._loadedForTime = void 0), (e.has("scrubbing") || e.has("live") || e.has("cameraId") || e.has("targetTime") && !this.scrubbing) && this._holdFrame(), e.has("scrubbing")) {
      const t = this.scrubbing ? [this._followVidA, this._followVidB] : [this._previewVidA, this._previewVidB];
      for (const i of t) i && Dt(i);
    }
  }
  _onHostVisibility(e) {
    e !== !this._hidden && (this._hidden = !e, this._hidden ? this._muteAndPauseAll() : this._resumeAfterVisible());
  }
  /** Silence + pause EVERY player (live stream's inner <video>, clip, follow,
   *  preview) so nothing plays audio while the card is hidden. */
  _muteAndPauseAll() {
    this._stopLivePoll();
    const e = [
      this._liveVideo(),
      this._video,
      this._followVidA,
      this._followVidB,
      this._previewVidA,
      this._previewVidB
    ];
    for (const t of e)
      if (t) {
        t.muted = !0;
        try {
          t.pause();
        } catch {
        }
      }
  }
  /** Re-shown after being hidden: re-assert LIVE playback. Restore the user's
   *  mute preference and resume playing — UNLESS the user had deliberately
   *  paused live before the hide (`_livePausedState`, untouched by the forced
   *  hide-pause since the poll was stopped). Play DIRECTLY here rather than via
   *  _hideLiveTimeline: restarting the poll re-reports the still-paused frame as
   *  a pause, which would gate _hideLiveTimeline's own resume. Historical clips
   *  stay paused — we don't auto-resume a clip the user didn't return to. */
  _resumeAfterVisible() {
    if (!this._liveStream) return;
    const e = this._liveVideo();
    e && (e.muted = this._liveMuted, !this._livePausedState && e.paused && e.play?.().catch(() => {
    })), this._startLivePoll(), this._hideLiveTimeline();
  }
  /**
   * Best-effort: hide the seek bar in the live stream's (nested-shadow) <video>
   * by injecting a style into its shadow root. The video loads async, so retry.
   */
  _hideLiveTimeline(e = 0) {
    clearTimeout(this._hideTimer);
    const t = this.renderRoot.querySelector("ha-camera-stream"), i = t ? this._deepVideo(t) : null;
    if (i) {
      this._liveMuted !== i.muted && (i.muted = this._liveMuted), !this._livePausedState && i.paused && i.play?.().catch(() => {
      });
      const s = i.getRootNode();
      if (s instanceof ShadowRoot && !s.querySelector("style[data-upc-hidebar]")) {
        const o = document.createElement("style");
        o.setAttribute("data-upc-hidebar", "1"), o.textContent = "video::-webkit-media-controls-timeline,video::-webkit-media-controls-current-time-display,video::-webkit-media-controls-time-remaining-display{display:none!important}", s.appendChild(o);
      }
    }
    e < 12 && (this._hideTimer = setTimeout(() => this._hideLiveTimeline(e + 1), 250));
  }
  _startLivePoll() {
    this._stopLivePoll(), this._lastLivePlaying = void 0, this._livePollTimer = setInterval(() => this._pollLive(), 500), this._pollLive();
  }
  _stopLivePoll() {
    clearInterval(this._livePollTimer), this._livePollTimer = void 0;
  }
  _pollLive() {
    const e = this.renderRoot.querySelector("ha-camera-stream"), t = e ? this._deepVideo(e) : null;
    t && this._reportLivePlaying(!t.paused);
  }
  _reportLivePlaying(e) {
    e !== this._lastLivePlaying && (this._lastLivePlaying = e, this._livePausedState = !e, this.dispatchEvent(
      new CustomEvent("live-playing", {
        detail: { playing: e },
        bubbles: !0,
        composed: !0
      })
    ));
  }
  _deepVideo(e) {
    const t = e.shadowRoot;
    if (!t) return null;
    const i = t.querySelector("video");
    if (i) return i;
    for (const s of Array.from(t.querySelectorAll("*"))) {
      const o = this._deepVideo(s);
      if (o) return o;
    }
    return null;
  }
  get _liveStream() {
    return this.live && this._streamReady;
  }
  firstUpdated() {
    this._fsDlg && (this._fsDlg.open = !0), this.startFs && (this.stacked ? (this._forceRotate = window.innerHeight > window.innerWidth, this._isFs = !0) : this.requestFullscreen?.().catch(() => {
    }));
  }
  updated(e) {
    if (this._hidden) {
      const t = this._liveVideo();
      if (t && (!t.paused || !t.muted)) {
        t.muted = !0;
        try {
          t.pause();
        } catch {
        }
      }
    }
    if (e.has("_isFs") && this.stacked && this._syncFsDialog(), this.live && !this._posterWarm && (this._posterWarm = this._posterUrl()), e.has("_followCtrl") || e.has("_isFs"))
      for (const t of this.querySelectorAll('[slot="fs-timeline"]'))
        t.toggleAttribute("inert", !this._followCtrl);
    if (e.has("_isFs") && e.get("_isFs") === !0 && !this._isFs && this.startFs && this.dispatchEvent(new CustomEvent("fs-exit", { bubbles: !0, composed: !0 })), e.has("scrubbing") && (this.scrubbing ? clearTimeout(this._followCtrlTimer) : this._followCtrl && this._showFollowCtrl()), (e.has("_isFs") || e.has("_forceRotate")) && this.dispatchEvent(
      new CustomEvent("fs-change", {
        detail: { fs: this._isFs, rotated: this._isFs && this._forceRotate },
        bubbles: !0,
        composed: !0
      })
    ), !(!this.hass || !this.nvrId || !this.cameraId)) {
      if (e.has("previewDir") && (this._resetPreviewSlots(), this._previewToken++, this._stopFollow(), this._warmPreview()), e.has("scrubbing") && this.scrubbing && this._warmPreview(), this._liveStream) {
        (e.has("live") || e.has("_streamReady")) && (this._cancelLoad(), this._stopFollow(), this._livePausedState = !1, this._liveMuted = !1, this._hideLiveTimeline(), this._startLivePoll(), this._flashFollowCtrl());
        return;
      }
      if (this._stopLivePoll(), e.has("scrubbing") && this.scrubbing) {
        this._cancelLoad(), this._stopFollow(), this._setClipSrc(), this._loadedForTime = void 0, this._loadingVideo = !1, this._error = void 0, this._updatePreview();
        return;
      }
      if (this.scrubbing) {
        (e.has("targetTime") || e.has("previewDir")) && this._updatePreview();
        return;
      }
      this.live ? (e.has("live") || e.has("_streamReady") || e.has("scrubbing")) && this._loadSegment(this.now, !0) : (e.has("scrubbing") || e.has("targetTime") || e.has("live") || e.has("cameraId")) && this._loadedForTime !== this.targetTime && (this._loadedForTime = this.targetTime, this.clipEndTime > this.targetTime + 500 ? (this._stopFollow(), this._loadSegment(this.targetTime)) : (this._cancelLoad(), this._setClipSrc(), this._startFollow(this.targetTime)));
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
  async _resolvePlayable(e) {
    const t = this._preview.tipBlockFor(e, this._preview.headEnd());
    if (t) {
      if (this._preview.isCached(t)) return t;
      this._preview.getBlock(t).then((o) => {
        o && this.scrubbing && this._updatePreview();
      });
    }
    const i = await this._resolveFine(e);
    if (i && this._preview.isCached(i)) return i;
    const s = this._preview.overviewBlockFor(e);
    return s && this._preview.isCached(s) ? (i && this._preview.getBlock(i), s) : i ?? s;
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
    if (!this.previewDir || !this.hass) return;
    this._preview.configure(this.hass, this.previewDir), this._preview.setTipEnabled(this.tipEnabled), this._preview.onTipUpdate = () => {
      this.scrubbing && this._updatePreview();
    }, this.scrubbing && this.tipEnabled && this.targetTime > Date.now() - me && this._preview.requestTip(), await this._preview.ensureIndex(this.targetTime);
    const e = await this._resolveFine(this.targetTime);
    e && this._preview.getBlock(e), this._warmOverview(this.targetTime);
  }
  /** Keep the overview units around `t` in cache. Fire-and-forget; the loader
   *  dedups and its LRU bounds the memory. */
  _warmOverview(e) {
    for (const i of [e, e - 36e5, e + 36e5]) {
      const s = this._preview.overviewBlockFor(i);
      s && !this._preview.isCached(s) && this._preview.getBlock(s);
    }
  }
  /** Point the preview at the unit covering targetTime: seek within the shown
   *  unit, or load the covering one into the STANDBY element and promote it
   *  once its frame has decoded — the active element never blanks. A time with
   *  no cached coverage keeps the last shown frame (UniFi-style). */
  async _updatePreview() {
    if (!this.previewDir || !this.hass || (this._preview.configure(this.hass, this.previewDir), await this._preview.ensureIndex(this.targetTime), this.tipEnabled && this.targetTime > Date.now() - me && (this._preview.requestTip(), this._preview.ensureTip()), !this.scrubbing)) return;
    const e = await this._resolvePlayable(this.targetTime);
    if (!e || !this.scrubbing) return;
    this._warmOverview(this.targetTime);
    const t = this._previewActive;
    if (t && this._previewBlocks[t]?.key === e.key) {
      this._seekPreview(t);
      for (const o of [e.start - 1, e.end + 1]) {
        const r = this._preview.blockFor(o);
        r && !r.mapped && r.key !== e.key && this._preview.getBlock(r);
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
      if (!this._preview.isCached(e) && (await new Promise((r) => setTimeout(r, 120)), s !== this._previewToken || !this.scrubbing))
        return;
      const o = await this._preview.getBlock(e);
      if (!o || s !== this._previewToken || this.scrubbing && (await this._resolvePlayable(this.targetTime))?.key !== e.key || s !== this._previewToken) return;
      this._loadPreviewInto(this._standbySlot(), e, o);
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
    const o = Math.min(1, Math.max(0, (this.targetTime - i.start) / (i.end - i.start))), r = Math.min(o * s, Math.max(0, s - 0.05));
    if (Math.abs(t.currentTime - r) < 0.02) {
      e !== this._previewActive && this._promotePreview(e);
      return;
    }
    if (t.seeking) {
      this._previewPending[e] = r;
      return;
    }
    this._previewPending[e] = void 0, t.currentTime = r;
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
      const s = this._previewBlocks[e], o = this._previewSrcOf(e);
      s && o && this._previewRetries[e] < 2 && (this._previewRetries[e]++, this._loadPreviewInto(this._standbySlot(), s, o));
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
    this._previewSrcA = void 0, this._previewSrcB = void 0, this._previewActive = null, this._previewBlocks = { a: void 0, b: void 0 }, this._previewPending = { a: void 0, b: void 0 }, this._previewRetries = { a: 0, b: 0 }, this._previewWant = void 0, this._preview.setPinned([]);
  }
  // ---- single-clip playback (bounded event clips + live-no-stream fallback) -
  // Continuous delayed playback goes through the follow engine above; this path
  // now only serves a BOUNDED event clip ([start, event end]) and the rare
  // "live but <ha-camera-stream> unavailable" trailing window.
  _segLenMs() {
    return Math.max(2, this.chunkSeconds) * 1e3;
  }
  /** Set the clip <video> src. This is a plain server URL now, not a blob, so
   *  there is nothing to revoke — the bytes live on the server for the life of
   *  the session and the element only ever holds its own buffer. */
  _setClipSrc(e) {
    this._videoSrc = e;
  }
  /** Play a single clip from `startMs`. Bounded event clip by default (ends at
   *  clipEndTime); `trailing` pulls the most-recent chunkSeconds window at now
   *  (live fallback when no live stream element is available). */
  async _loadSegment(e, t = !1) {
    const i = ++this._videoToken;
    this._setClipSrc(), this._error = void 0, this._loadingVideo = !0, this._autoplayDone = !1, this._clipPaused = !1, this._clipRate = 1, this._clipProgress = 0, this._preparing = !0, this._flashFollowCtrl();
    let s = e, o;
    if (t ? (o = this.now, s = Math.max(this.now - this._segLenMs(), 0)) : o = Math.min(this.clipEndTime, this.now), o - s < 1500) {
      this._loadingVideo = !1, this._preparing = !1;
      return;
    }
    this._clipStart = s, this._endClipSession();
    const r = new AbortController();
    this._sessionAbort = r;
    try {
      const a = await gi(
        this.hass,
        this.nvrId,
        this.cameraId,
        s,
        o,
        r.signal
      );
      if (i !== this._videoToken) {
        oe(this.hass, a.session_id);
        return;
      }
      this._sessionId = a.session_id, this._setClipSrc(a.url);
    } catch (a) {
      if (i !== this._videoToken || a?.name === "AbortError") return;
      console.warn("[unifi-timeline] clip session failed", a), this._onVideoError();
    } finally {
      this._sessionAbort === r && (this._sessionAbort = void 0), i === this._videoToken && (this._preparing = !1);
    }
  }
  /** Release the current clip's server-side working directory. */
  _endClipSession() {
    this._sessionAbort?.abort(), this._sessionAbort = void 0, this._sessionId && (oe(this.hass, this._sessionId), this._sessionId = void 0);
  }
  /** Seconds -> "M:SS" (e.g. 5 -> "0:05", 75 -> "1:15"). */
  _fmtClock(e) {
    (!isFinite(e) || e < 0) && (e = 0);
    const t = Math.floor(e / 60), i = Math.floor(e % 60);
    return `${t}:${i.toString().padStart(2, "0")}`;
  }
  // ---- clip seek bar (drag/click to scrub the fully-buffered blob) ----------
  _seekTo(e, t) {
    const i = this._video;
    if (!i || !isFinite(i.duration) || i.duration <= 0) return;
    const s = t.getBoundingClientRect(), o = this._forceRotate ? Math.min(1, Math.max(0, (e.clientY - s.top) / s.height)) : Math.min(1, Math.max(0, (e.clientX - s.left) / s.width));
    i.currentTime = o * i.duration, this._clipProgress = o, this._clipTime = i.currentTime, this._clipDuration = i.duration;
  }
  // ---- delayed-follow engine -----------------------------------------------
  _followVideo(e) {
    return e === "a" ? this._followVidA : this._followVidB;
  }
  /** Tear down the follow engine: invalidate in-flight fetches, drop both srcs
   *  (aborting their NVR exports), and clear state. */
  _stopFollow() {
    this._followToken++, clearTimeout(this._followRetry), this._followRetry = void 0, clearTimeout(this._followWatch.a), clearTimeout(this._followWatch.b), this._followWatch = { a: void 0, b: void 0 }, this._followWatchTries = { a: 0, b: 0 }, this._tapToPlay = !1, this._followActive = null, this._followSrcA?.startsWith("blob:") && URL.revokeObjectURL(this._followSrcA), this._followSrcB?.startsWith("blob:") && URL.revokeObjectURL(this._followSrcB), this._followSrcA = void 0, this._followSrcB = void 0, this._followMeta.a = { start: 0, end: 0, ready: !1, leadIn: 0 }, this._followMeta.b = { start: 0, end: 0, ready: !1, leadIn: 0 }, this._followSwapArmed = !1;
  }
  /** Begin continuous delayed playback from `startMs`, holding ~delaySeconds
   *  behind live. Clamped so it never starts closer than the export-availability
   *  floor (~12s); slot A loads the first chunk, then B prefetches the next. */
  async _startFollow(e) {
    this._stopFollow();
    const t = ++this._followToken;
    this._error = void 0, this._loadingVideo = !0, this._followPaused = !1, this._nearLive = !1, this._followActive = "a", this._flashFollowCtrl();
    const i = Math.max(this.delaySeconds, 12) * 1e3, s = Math.max(0, Math.min(e, this.now - i));
    this._followPlayhead = s;
    const o = await this._fetchFollowChunk("a", s, t);
    t === this._followToken && (o || this._scheduleFollowRetry("a", s, t));
  }
  /** Fetch the chunk starting at `startMs` into `slot`: end at the next tier
   *  boundary (single-quality export), capped at the availability edge and a max
   *  length. Returns the chunk range, or null when nothing is available yet. */
  async _fetchFollowChunk(e, t, i) {
    let s = t;
    const o = this.gaps.find((d) => s >= d.start && s < d.end);
    o && (s = o.end);
    let r = s + u.FOLLOW_MAX_CHUNK_MS;
    const a = this.now - u.FOLLOW_AVAIL_LAG_MS;
    if (r > a && (r = a), r - s < 1500) return null;
    const n = mi(this.nvrId, this.cameraId, s, r), l = await Pe(this.hass, n, 300);
    if (i !== this._followToken) return null;
    let p;
    try {
      const d = await fetch(l);
      if (!d.ok || i !== this._followToken) return null;
      const g = await d.blob();
      if (i !== this._followToken) return null;
      p = URL.createObjectURL(g);
    } catch {
      return null;
    }
    const _ = e === "a" ? this._followSrcA : this._followSrcB;
    return _?.startsWith("blob:") && URL.revokeObjectURL(_), this._followMeta[e] = { start: s, end: r, ready: !1, leadIn: 0 }, e === "a" ? this._followSrcA = p : this._followSrcB = p, this._kickFollowSlot(e, i), { start: s, end: r };
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
      ge(t) && (e.muted = !0, e.play().then(() => {
        this._followMuted = !0, this._tapToPlay = !1;
      }).catch((i) => {
        ge(i) && (this._tapToPlay = !0, this._loadingVideo = !1);
      }));
    });
  }
  /** The chunk's src has landed: watch that it actually becomes playable.
   *  Nothing is forced here — pairing load() with an immediate play() only
   *  makes the play reject with AbortError. The watchdog does the recovering,
   *  and only if the normal event chain fails to arrive. */
  async _kickFollowSlot(e, t) {
    await this.updateComplete, t === this._followToken && (this._followMeta[e].ready || this._armFollowWatchdog(e, t));
  }
  /** Re-drive a slot that never reported itself ready.
   *
   *  The engine is entirely event-driven (loadeddata -> seek -> seeked), so one
   *  missed event used to strand the stage forever: a spinner on the active
   *  slot, or a freeze at the chunk boundary when it was the standby that never
   *  loaded. The two forcing functions are applied on SEPARATE attempts —
   *  load() first, then play() — because together they cancel each other. */
  _armFollowWatchdog(e, t) {
    clearTimeout(this._followWatch[e]), this._followWatch[e] = setTimeout(() => {
      if (t !== this._followToken) return;
      const i = this._followMeta[e], s = this._followVideo(e);
      if (!s || i.ready) return;
      const o = e === this._followActive;
      if (this._followWatchTries[e] >= 2) {
        this._followWatchTries[e] = 0, o && (this._loadingVideo = !0), this._scheduleFollowRetry(e, i.start, t);
        return;
      }
      if (this._followWatchTries[e] === 0)
        try {
          s.load();
        } catch {
        }
      else o && !this._followPaused && this._playFollowVideo(s);
      this._followWatchTries[e]++, this._armFollowWatchdog(e, t);
    }, u.FOLLOW_STALL_MS);
  }
  /** Prefetch the NEXT chunk (from _followPlayhead) into the standby slot so the
   *  swap is instant. Retries if footage isn't available yet. */
  _prefetchFollow(e) {
    if (e !== this._followToken || this._followActive === null) return;
    const t = this._followActive === "a" ? "b" : "a", i = this._followPlayhead;
    this._fetchFollowChunk(t, i, e).then((s) => {
      e === this._followToken && (s || this._scheduleFollowRetry(t, i, e));
    });
  }
  _scheduleFollowRetry(e, t, i) {
    clearTimeout(this._followRetry), this._followRetry = setTimeout(() => {
      i === this._followToken && this._fetchFollowChunk(e, t, i).then((s) => {
        i === this._followToken && (s || this._scheduleFollowRetry(e, t, i));
      });
    }, 700);
  }
  /** A follow slot finished buffering. Active slot -> start playing + prefetch
   *  the next chunk; standby slot -> ready for a gapless swap (and cover a swap
   *  that was already waiting on it). */
  _onFollowLoaded(e) {
    const t = this._followMeta[e];
    if (t.start === 0 || t.ready) return;
    const i = this._followVideo(e);
    !i || !isFinite(i.duration) || i.duration <= 0 || (t.leadIn = Math.max(0, i.duration - (t.end - t.start) / 1e3), t.leadIn <= 0.05 ? this._followSlotReady(e) : i.currentTime = t.leadIn);
  }
  _onFollowSeeked(e) {
    const t = this._followMeta[e];
    t.start === 0 || t.ready || this._followSlotReady(e);
  }
  /** A slot is positioned at its lead-in and ready to show. Start it if it's the
   *  active slot (and prefetch the next chunk), or complete a pending swap. */
  _followSlotReady(e) {
    const t = this._followMeta[e];
    t.ready = !0, clearTimeout(this._followWatch[e]), this._followWatchTries[e] = 0;
    const i = this._followVideo(e);
    i && (e === this._followActive ? (this._loadingVideo = !1, this._followSwapArmed = !1, i.playbackRate = this._followRate, this._followPaused || this._playFollowVideo(i), this._followPlayhead = t.end, this._prefetchFollow(this._followToken)) : this._followSwapArmed && this._swapFollow());
  }
  _onFollowTime(e) {
    if (e !== this._followActive) return;
    const t = this._followVideo(e), i = this._followMeta[e];
    if (!t || !isFinite(t.duration)) return;
    const s = i.end - t.duration * 1e3 + t.currentTime * 1e3;
    this.dispatchEvent(
      new CustomEvent("playback-time", { detail: { time: s }, bubbles: !0, composed: !0 })
    );
    const o = this.now - s < this._nearLiveMs;
    o !== this._nearLive && (this._nearLive = o), o && this._followRate !== 1 && this._setFollowRate(1);
  }
  _onFollowEnded(e) {
    if (e !== this._followActive) return;
    const t = e === "a" ? "b" : "a";
    this._followMeta[t].ready ? this._swapFollow() : this._followSwapArmed = !0;
  }
  /** Leap-frog: make the standby slot active (already buffered -> instant),
   *  pause the old one, advance the playhead, and prefetch the next chunk. */
  _swapFollow() {
    const e = this._followActive;
    if (e === null) return;
    const t = e === "a" ? "b" : "a";
    if (!this._followMeta[t].ready) {
      this._followSwapArmed = !0;
      return;
    }
    const i = this._followVideo(t);
    i && (this._followActive = t, this._followSwapArmed = !1, i.playbackRate = this._followRate, this._followPaused || this._playFollowVideo(i), this._followVideo(e)?.pause(), this._followPlayhead = this._followMeta[t].end, this._prefetchFollow(this._followToken));
  }
  _onFollowError(e) {
    if (this._followMeta[e].start !== 0) {
      if (e !== this._followActive) {
        this._followMeta[e].ready = !1;
        return;
      }
      this._scheduleFollowRetry(e, this._followMeta[e].start, this._followToken);
    }
  }
  /** Mean luminance over a small sample; a copy this dark is a failed copy. */
  _looksBlack(e, t) {
    try {
      const i = Math.min(32, t.width), s = Math.min(32, t.height);
      if (!i || !s) return !0;
      const o = e.getImageData(0, 0, i, s).data;
      let r = 0;
      for (let a = 0; a < o.length; a += 4) r += (o[a] + o[a + 1] + o[a + 2]) / 3;
      return r / (o.length / 4) < 3;
    } catch {
      return !0;
    }
  }
  /** The camera's current thumbnail from HA — kept as the fallback still. */
  _posterUrl() {
    const e = this.hass?.states?.[this.cameraId]?.attributes?.entity_picture;
    return typeof e == "string" ? e : "";
  }
  /** Whatever the viewer can actually see right now, whichever player owns the
   *  stage. Ordered by which one is on top when several are mounted. */
  _visibleVideo() {
    return [
      this._previewActive ? this._previewVideo(this._previewActive) : void 0,
      this._followActive ? this._followVideo(this._followActive) : void 0,
      this._video,
      this._liveVideo()
    ].find((t) => t && t.readyState >= 2 && t.videoWidth > 0);
  }
  /** Copy the current frame onto the overlay canvas and hold it. No-op when
   *  nothing is showing yet — a black hold is worse than the honest black. */
  _holdFrame() {
    const e = this._visibleVideo(), t = this._freezeCanvas;
    if (this._frozen && !e) {
      this._watchForFirstFrame();
      return;
    }
    if (!t) return;
    let i = !1;
    if (e)
      try {
        (t.width !== e.videoWidth || t.height !== e.videoHeight) && (t.width = e.videoWidth, t.height = e.videoHeight);
        const o = t.getContext("2d", { willReadFrequently: !0 });
        o?.clearRect(0, 0, t.width, t.height), o?.drawImage(e, 0, 0, t.width, t.height), i = !!o && !this._looksBlack(o, t);
      } catch {
        i = !1;
      }
    if (this._holdPoster = i ? "" : this._posterWarm || this._posterUrl(), !i && !this._holdPoster) return;
    this._frozen = !0;
    const s = this._freezeImg;
    i ? (t.removeAttribute("hidden"), s?.setAttribute("hidden", "")) : s && (s.getAttribute("src") || (s.src = this._holdPoster), s.removeAttribute("hidden"), t.setAttribute("hidden", "")), this._frozenFrom = e ? { el: e, src: e.currentSrc || e.src } : void 0, this._watchForFirstFrame();
  }
  /** Drop the hold as soon as SOME player is painting again. Polled on rAF
   *  rather than wired into each player's events: four different sources take
   *  over this stage (live, clip, follow, preview) and they announce themselves
   *  differently — one condition covers them all and cannot be forgotten when a
   *  fifth is added. Backstopped by a timer so a failed load can never leave a
   *  stale frame pinned over the player. */
  _watchForFirstFrame() {
    cancelAnimationFrame(this._freezeRaf), clearTimeout(this._freezeTimer), this._framePresented = !1, this._rvfcKey = void 0;
    const e = performance.now(), t = () => {
      if (this._framePresented) {
        this._releaseFrame();
        return;
      }
      const i = this._visibleVideo(), s = this._frozenFrom, o = !!i && (!s || i !== s.el || (i.currentSrc || i.src) !== s.src);
      if (i && o) {
        const r = i.requestVideoFrameCallback, a = `${(i.currentSrc || i.src) ?? ""}`;
        if (r && this._rvfcKey !== a)
          this._rvfcKey = a, r.call(i, () => {
            this._framePresented = !0;
          });
        else if (!r && i.readyState >= 3 && i.currentTime > 0 && !i.seeking) {
          this._releaseFrame();
          return;
        }
      }
      if (performance.now() - e > ys) {
        this._releaseFrame();
        return;
      }
      this._freezeRaf = requestAnimationFrame(t);
    };
    this._freezeRaf = requestAnimationFrame(t);
  }
  _releaseFrame() {
    cancelAnimationFrame(this._freezeRaf), this._freezeRaf = 0, clearTimeout(this._freezeTimer), this._freezeTimer = void 0, this._frozenFrom = void 0, this._framePresented = !1, this._rvfcKey = void 0, this._holdPoster = "", this._frozen = !1, this._freezeCanvas?.setAttribute("hidden", ""), this._freezeImg?.setAttribute("hidden", "");
  }
  /** The automatic "here are the controls" flash when a player starts. Skipped
   *  right after the user dismissed them by hand: dragging the timeline and
   *  then tapping to clear the chrome starts playback a beat later, and that
   *  must not undo the tap. */
  _flashFollowCtrl() {
    Date.now() - this._ctrlDismissedAt < 1500 || this._showFollowCtrl();
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
  // ---- LIVE custom controls (native controls off; same bar as delayed-follow) --
  _liveVideo() {
    const e = this.renderRoot.querySelector("ha-camera-stream");
    return e ? this._deepVideo(e) : null;
  }
  /** The content time (epoch ms) the active chunk is currently showing. */
  _followContentNow() {
    const e = this._followActive;
    if (!e) return null;
    const t = this._followVideo(e), i = this._followMeta[e];
    return !t || !isFinite(t.duration) ? null : i.end - t.duration * 1e3 + t.currentTime * 1e3;
  }
  /** Jump ±deltaMs from the current content time and re-follow from there.
   *  Forward is clamped to the availability floor by _startFollow. */
  /** Tell the host we are jumping to `t` RIGHT NOW, before the seek completes.
   *  A skip re-exports and reloads footage, which takes a second or two; the
   *  ruler must not sit still until then, so it glides on the press and the
   *  playback-time that eventually arrives is already where it is pointing. */
  _announceSeek(e) {
    this._holdFrame(), this.dispatchEvent(
      new CustomEvent("playback-seek", { detail: { time: e }, bubbles: !0, composed: !0 })
    );
  }
  _followSkip(e) {
    const t = this._followContentNow();
    if (t == null) return;
    this._announceSeek(t + e);
    const i = this._followPaused;
    this._startFollow(t + e), this._followPaused = i, this._showFollowCtrl();
  }
  // "Near live" = as close as the follow can get: it rests at ~delaySeconds +
  // a couple seconds of export overhead, so the window must be a bit above the
  // floor (delaySeconds) or it never triggers at the resting position. Within
  // it, skip-forward jumps to live and speed reverts to 1× (nothing ahead to
  // fast-forward through).
  get _nearLiveMs() {
    return (this.delaySeconds + 5) * 1e3;
  }
  _followNearLive() {
    const e = this._followContentNow();
    return e != null && this.now - e < this._nearLiveMs;
  }
  _setFollowRate(e) {
    this._followRate !== e && (this._followRate = e, [this._followVidA, this._followVidB].forEach((t) => {
      t && (t.playbackRate = e);
    }));
  }
  /** The custom control bar, shared by all three players (LIVE, delayed-follow,
   *  bounded event clip) so they feel identical. Live greys skip-forward + speed
   *  (nothing ahead of live); follow greys speed near the live edge (and its
   *  skip-forward jumps to live there); a clip enables everything. */
  _renderCtrlBar(e, t = !1) {
    t || (this._ctrlMode = e);
    const i = e === "live", s = e === "clip", o = i ? this._livePausedState : s ? this._clipPaused : this._followPaused, r = i ? this._liveMuted : s ? this._clipMuted : this._followMuted, a = s ? this._clipRate : i ? 1 : this._followRate, n = s ? this._clipRate > 1 : !i && this._followRate > 1, l = i || e === "follow" && this._nearLive, p = i ? this._liveSkipBack : s ? this._clipSkipBack : this._skipBack, _ = i ? this._toggleLivePlay : s ? this._toggleClipPlay : this._toggleFollowPlay, d = s ? this._clipSkipFwd : this._skipFwd, g = s ? this._toggleClipRate : this._toggleFollowRate, b = i ? this._toggleLiveMute : s ? this._toggleClipMute : this._toggleFollowMute, x = e === "follow" && this._nearLive ? "Go live" : "Forward 15s";
    return c`
      <div
        class="vctrl ${this._followCtrl ? "show" : ""} ${this._isFs ? "fs" : ""} ${this._fsStrip ? "fs-inset" : ""} ${t ? "inert" : ""}"
        style="--upc-fs-tl-w:${this.fsTimelineWidth}px;--upc-fs-tl-gut:${this.fsTimelineGutter}px;--upc-fs-tl-pad:${this.fsTimelinePadding}px"
        @click=${(F) => F.stopPropagation()}
      >
        <button @click=${p} title="Back 15s">
          <ha-icon icon="mdi:rewind-15"></ha-icon>
        </button>
        <button @click=${_} title=${o ? "Play" : "Pause"}>
          <ha-icon icon=${o ? "mdi:play" : "mdi:pause"}></ha-icon>
        </button>
        <button ?disabled=${i} @click=${i ? void 0 : d} title=${x}>
          <ha-icon icon="mdi:fast-forward-15"></ha-icon>
        </button>
        <button
          class="vctrl-speed ${n ? "on" : ""}"
          ?disabled=${l}
          @click=${i ? void 0 : g}
          title="Playback speed"
        >
          ${a}×
        </button>
        <button @click=${b} title=${r ? "Unmute" : "Mute"}>
          <ha-icon icon=${r ? "mdi:volume-off" : "mdi:volume-high"}></ha-icon>
        </button>
        <button class="vfs" @click=${this._toggleFs} title="Fullscreen">
          <ha-icon icon=${this._isFs ? "mdi:fullscreen-exit" : "mdi:fullscreen"}></ha-icon>
        </button>
        ${s ? c`<div class="vseek-row">
              <span class="vtime"
                >${this._fmtClock(this._clipTime)} / ${this._fmtClock(this._clipDuration)}</span
              >
              <div class="vseek" @pointerdown=${this._onSeekDown}>
                <div class="vseek-track">
                  <div class="vseek-fill" style="width:${this._clipProgress * 100}%"></div>
                  <div class="vseek-knob" style="left:${this._clipProgress * 100}%"></div>
                </div>
              </div>
            </div>` : c`<div class="vctrl-spacer"></div>`}
      </div>
    `;
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
    if (!this._fsStrip) return v;
    const e = (o) => {
      o.stopPropagation(), this._showFollowCtrl();
    }, t = this.fsTimelineScrim, i = `linear-gradient(to left, rgba(0,0,0,${t}) 30%, rgba(0,0,0,${(t * 0.78).toFixed(3)}) 55%, rgba(0,0,0,${(t * 0.35).toFixed(3)}) 80%, transparent)`, s = this.fsTimelineGrabWidth > 0 ? `calc(${Math.max(this.fsTimelineWidth, this.fsTimelineGrabWidth)}px + ${this.fsTimelineGutter}px)` : "100%";
    return c`<div
      class="fs-tl ${this._followCtrl ? "show" : ""}"
      style="--upc-fs-tl-w:${this.fsTimelineWidth}px;--upc-fs-tl-boxw:${s};--upc-fs-tl-gut:${this.fsTimelineGutter}px;--upc-fs-tl-pad:${this.fsTimelinePadding}px;--upc-fs-tl-scrim-ext:${this.fsTimelineScrimExtend}px;--upc-fs-tl-bg:${i}"
      @pointerdown=${e}
      @pointermove=${e}
      @wheel=${e}
      @pointerup=${(o) => o.stopPropagation()}
      @pointercancel=${(o) => o.stopPropagation()}
      @click=${this._onStripBlankTap}
      @tap-through=${this._onStripTap}
    >
      <slot name="fs-timeline"></slot>
    </div>`;
  }
  render() {
    const e = this._stage(), t = c`
      <canvas class="freeze" ?hidden=${!this._frozen || !!this._holdPoster}></canvas>
      <img
        class="freeze"
        src=${this._posterWarm || v}
        ?hidden=${!this._frozen || !this._holdPoster}
        alt=""
      />
    `;
    return this.stacked ? c`<dialog
      class="fs-wrap ${this._isFs ? "fs-active" : ""} ${this._forceRotate ? "rotate" : ""}"
      @close=${this._onDlgClose}
    >
      ${e}${t}${this._renderFsTimeline()}
    </dialog>` : c`${e}${t}${this._renderFsTimeline()}`;
  }
  _stage() {
    if (!this.nvrId || !this.cameraId)
      return c`<div class="stage"><div class="msg error">Missing camera / nvr_id.</div></div>`;
    if (this._liveStream) {
      const e = this.hass.states[this.cameraId];
      return c`
        <div
          class="stage live-stage"
          style=${this.accent ? `--upc-accent:${this.accent}` : ""}
          @pointermove=${this._showFollowCtrl}
          @pointerdown=${this._onStagePress}
          @click=${this._onStageTap}
        >
          ${e ? c`<ha-camera-stream
                  .hass=${this.hass}
                  .stateObj=${e}
                  .controls=${!1}
                  allow-exoplayer
                ></ha-camera-stream>
                ${this._renderCtrlBar("live")}` : c`<div class="msg error">Camera entity not found.</div>`}
        </div>
      `;
    }
    if (this.scrubbing)
      return c`
        <div class="stage" style=${this.accent ? `--upc-accent:${this.accent}` : ""}>
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
          ${this._renderCtrlBar(this._ctrlMode, !0)}
        </div>
      `;
    if (this._followActive !== null)
      return c`
        <div
          class="stage follow-stage"
          style=${this.accent ? `--upc-accent:${this.accent}` : ""}
          @pointermove=${this._showFollowCtrl}
          @pointerdown=${this._onStagePress}
          @click=${this._onStageTap}
        >
          <video
            class="follow-a ${this._followActive === "a" ? "follow-on" : "follow-off"}"
            playsinline
            preload="auto"
            .muted=${this._followMuted}
            .src=${this._followSrcA ?? ""}
            @loadeddata=${() => this._onFollowLoaded("a")}
            @seeked=${() => this._onFollowSeeked("a")}
            @timeupdate=${() => this._onFollowTime("a")}
            @ended=${() => this._onFollowEnded("a")}
            @error=${() => this._onFollowError("a")}
          ></video>
          <video
            class="follow-b ${this._followActive === "b" ? "follow-on" : "follow-off"}"
            playsinline
            preload="auto"
            .muted=${this._followMuted}
            .src=${this._followSrcB ?? ""}
            @loadeddata=${() => this._onFollowLoaded("b")}
            @seeked=${() => this._onFollowSeeked("b")}
            @timeupdate=${() => this._onFollowTime("b")}
            @ended=${() => this._onFollowEnded("b")}
            @error=${() => this._onFollowError("b")}
          ></video>
          ${this._tapToPlay ? c`<button class="tap-play" @click=${this._onTapToPlay} title="Play">▶</button>` : this._loadingVideo ? c`<div class="overlay"><div class="spinner"></div></div>` : v}
          ${this._error ? c`<div class="msg error">${this._error}</div>` : v}
          ${this._renderCtrlBar("follow")}
        </div>
      `;
    if (!this._videoSrc) {
      const e = !this.live && ze(this.gaps, this.targetTime);
      return c`<div
        class="stage"
        style=${this.accent ? `--upc-accent:${this.accent}` : ""}
        @pointermove=${this._showFollowCtrl}
        @pointerdown=${this._onStagePress}
        @click=${this._onStageTap}
      >
        ${this.live ? c`<div class="overlay"><div class="spinner"></div>Connecting…</div>` : e ? c`<div class="msg">Footage unavailable — camera was offline.</div>` : this._loadingVideo ? this._preparing ? (
        // No percentage any more: the transfer happens NVR->server, so
        // there is nothing client-side to measure. Export dominates
        // (~5.6s for a 5-minute clip), the remux is ~0.3s.
        c`<div class="overlay"><div class="spinner"></div>Preparing clip…</div>`
      ) : c`<div class="overlay"><div class="spinner"></div></div>` : this._error ? c`<div class="msg error">${this._error}</div>` : c`<div class="msg">Tap the timeline to play from a time.</div>`}
        ${this._isFs ? this._renderCtrlBar(this._ctrlMode, !0) : v}
      </div>`;
    }
    return c`
      <div
        class="stage clip-stage"
        style=${this.accent ? `--upc-accent:${this.accent}` : ""}
        @pointermove=${this._showFollowCtrl}
        @pointerdown=${this._onStagePress}
        @click=${this._onStageTap}
      >
        <video
          class="clip ${this._loadingVideo ? "loading" : ""}"
          autoplay
          playsinline
          preload="auto"
          .src=${this._videoSrc}
          @timeupdate=${this._onTimeUpdate}
          @ended=${this._onEnded}
          @canplay=${this._onVideoReady}
          @playing=${this._onVideoReady}
          @play=${() => this._clipPaused = !1}
          @pause=${() => this._clipPaused = !0}
          @error=${this._onVideoError}
        ></video>
        ${this._renderCtrlBar("clip")}
        ${this._error ? c`<div class="msg error">${this._error}</div>` : v}
      </div>
    `;
  }
};
u.FOLLOW_STALL_MS = 2500;
u.FOLLOW_AVAIL_LAG_MS = 8e3;
u.FOLLOW_MAX_CHUNK_MS = 3e4;
u.styles = st`
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
    /* The held frame. A still copy of the last thing the player showed, laid
       over the stage while the next source loads, so a seek/skip/mode change
       never flashes black (UniFi-app behaviour). It is a SIBLING of .stage, not
       a child: each mode returns its own .stage template, so anything inside
       would be destroyed by the very swap it exists to cover.
       canvas is a replaced element, so object-fit letterboxes it exactly like
       the <video> it was copied from. Above the players, below the chrome. */
    canvas.freeze,
    img.freeze {
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
    video,
    img.snap {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    /* --video-max-height is LOAD-BEARING. Both of HA's players style their inner
       <video> (in their own shadow root, which we cannot reach) as:
           video { width: 100%; max-height: var(--video-max-height, calc(100vh - 97px)); }
       That 97px is HA's allowance for its own toolbar. Our FULLSCREEN stage IS
       100vh, so the cap binds: the video box became 703px in an 800px stage and,
       being display:block, sat at the TOP — live showed a slightly smaller
       picture pinned high while scrub/clip/follow (object-fit: contain on our own
       <video>) were centred, so switching to live visibly jumped the image up.
       Measured 1250x703 @ gap 0/97 before, 1280x720 @ gap 40/40 after — i.e. this
       also stops the picture being needlessly shrunk. The custom property
       inherits through the shadow boundary, which is the only lever we have.
       Not reproducible outside fullscreen: there the stage is shorter than
       100vh - 97px, so the cap never binds.
       The flex centring is belt-and-braces for any future player that ends up
       auto-height; measured a no-op for both current ones. */
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
    }
    /* Clip/scrub/idle overlay drawn ON TOP of the always-mounted live element,
       so live is never torn down (that's what dropped HLS audio on return). */
    .overlay-stage {
      position: absolute;
      inset: 0;
      background: #000;
      z-index: 2;
    }
    video {
      opacity: 1;
      transition: opacity 0.15s ease;
    }
    video.loading {
      opacity: 0;
    }
    /* Delayed-follow leap-frog videos: the active one is on top and opaque, the
       standby one sits underneath buffering the next chunk (no transition — a
       fade would reveal a seam at the swap). */
    video.follow-a,
    video.follow-b {
      transition: none;
    }
    video.follow-off {
      opacity: 0;
      z-index: 0;
    }
    video.follow-on {
      opacity: 1;
      z-index: 1;
    }
    /* Scrub-preview leap-frog videos — same deal: the standby one loads and
       seeks the next block/part underneath, then swaps in already decoded. */
    video.preview-a,
    video.preview-b {
      transition: none;
    }
    video.preview-off {
      opacity: 0;
      z-index: 0;
    }
    video.preview-on {
      opacity: 1;
      z-index: 1;
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
    .dl {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .dl-bar {
      width: 55%;
      max-width: 260px;
      height: 5px;
      border-radius: 3px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.2);
    }
    .dl-fill {
      height: 100%;
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      transition: width 0.1s linear;
    }
    .dl-pct {
      color: #fff;
      font-size: 13px;
      font-weight: 600;
    }
    .overlay {
      position: absolute;
      inset: 0;
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
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(255, 255, 255, 0.25);
      border-top-color: var(--primary-color, #03a9f4);
      border-radius: 50%;
      animation: upc-spin 0.8s linear infinite;
    }
    @keyframes upc-spin {
      to {
        transform: rotate(360deg);
      }
    }
    .msg {
      position: absolute;
      inset: 0;
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
m([
  h({ attribute: !1 })
], u.prototype, "hass", 2);
m([
  h()
], u.prototype, "nvrId", 2);
m([
  h()
], u.prototype, "cameraId", 2);
m([
  h({ attribute: !1 })
], u.prototype, "gaps", 2);
m([
  h({ attribute: !1 })
], u.prototype, "footageSpans", 2);
m([
  h({ type: Number })
], u.prototype, "targetTime", 2);
m([
  h({ type: Boolean })
], u.prototype, "scrubbing", 2);
m([
  h({ type: Boolean })
], u.prototype, "live", 2);
m([
  h({ type: Number })
], u.prototype, "chunkSeconds", 2);
m([
  h({ type: Number })
], u.prototype, "now", 2);
m([
  h()
], u.prototype, "previewDir", 2);
m([
  h({ type: Boolean })
], u.prototype, "tipEnabled", 2);
m([
  h({ type: Number })
], u.prototype, "clipEndTime", 2);
m([
  h()
], u.prototype, "accent", 2);
m([
  h({ type: Number })
], u.prototype, "delaySeconds", 2);
m([
  h({ type: Boolean, reflect: !0 })
], u.prototype, "stacked", 2);
m([
  h({ type: Boolean })
], u.prototype, "startFs", 2);
m([
  h({ type: Boolean })
], u.prototype, "fsTimeline", 2);
m([
  h({ type: Number })
], u.prototype, "fsTimelineWidth", 2);
m([
  h({ type: Number })
], u.prototype, "fsTimelineGrabWidth", 2);
m([
  h({ type: Number })
], u.prototype, "fsTimelinePadding", 2);
m([
  h({ type: Number })
], u.prototype, "fsTimelineGutter", 2);
m([
  h({ type: Number })
], u.prototype, "fsTimelineScrim", 2);
m([
  h({ type: Number })
], u.prototype, "fsTimelineScrimExtend", 2);
m([
  f()
], u.prototype, "_videoSrc", 2);
m([
  f()
], u.prototype, "_loadingVideo", 2);
m([
  f()
], u.prototype, "_error", 2);
m([
  f()
], u.prototype, "_streamReady", 2);
m([
  U(".fs-wrap")
], u.prototype, "_fsDlg", 2);
m([
  U("video.clip")
], u.prototype, "_video", 2);
m([
  U("video.preview-a")
], u.prototype, "_previewVidA", 2);
m([
  U("video.preview-b")
], u.prototype, "_previewVidB", 2);
m([
  U("video.follow-a")
], u.prototype, "_followVidA", 2);
m([
  U("video.follow-b")
], u.prototype, "_followVidB", 2);
m([
  f()
], u.prototype, "_followSrcA", 2);
m([
  f()
], u.prototype, "_followSrcB", 2);
m([
  f()
], u.prototype, "_followActive", 2);
m([
  f()
], u.prototype, "_followPaused", 2);
m([
  f()
], u.prototype, "_followMuted", 2);
m([
  f()
], u.prototype, "_tapToPlay", 2);
m([
  f()
], u.prototype, "_followCtrl", 2);
m([
  f()
], u.prototype, "_isFs", 2);
m([
  f()
], u.prototype, "_forceRotate", 2);
m([
  f()
], u.prototype, "_followRate", 2);
m([
  f()
], u.prototype, "_nearLive", 2);
m([
  f()
], u.prototype, "_livePausedState", 2);
m([
  f()
], u.prototype, "_liveMuted", 2);
m([
  f()
], u.prototype, "_clipPaused", 2);
m([
  f()
], u.prototype, "_clipMuted", 2);
m([
  f()
], u.prototype, "_clipRate", 2);
m([
  f()
], u.prototype, "_clipProgress", 2);
m([
  f()
], u.prototype, "_clipTime", 2);
m([
  f()
], u.prototype, "_clipDuration", 2);
m([
  f()
], u.prototype, "_preparing", 2);
m([
  f()
], u.prototype, "_previewSrcA", 2);
m([
  f()
], u.prototype, "_previewSrcB", 2);
m([
  f()
], u.prototype, "_previewActive", 2);
m([
  f()
], u.prototype, "_frozen", 2);
m([
  U("canvas.freeze")
], u.prototype, "_freezeCanvas", 2);
m([
  U("img.freeze")
], u.prototype, "_freezeImg", 2);
m([
  f()
], u.prototype, "_holdPoster", 2);
m([
  f()
], u.prototype, "_posterWarm", 2);
u = m([
  ot("upc-media-view")
], u);
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const xt = Le(class extends Oe {
  constructor() {
    super(...arguments), this.key = v;
  }
  render(e, t) {
    return this.key = e, t;
  }
  update(e, [t, i]) {
    return t !== this.key && (Ie(e), this.key = t), i;
  }
});
function xs(e, t, i) {
  return e.map((s) => ({ ...s, camera: t, cameraName: i }));
}
function $s(e) {
  return e.flat().sort((t, i) => i.start - t.start);
}
function ks(e, t) {
  const i = Math.max(0, Math.floor((t - e) / 1e3));
  if (i < 60) return "just now";
  const s = Math.floor(i / 60);
  if (s < 60) return s === 1 ? "1 minute ago" : `${s} minutes ago`;
  const o = Math.floor(s / 60);
  if (o < 24) return o === 1 ? "1 hour ago" : `${o} hours ago`;
  const r = Math.floor(o / 24);
  return r === 1 ? "1 day ago" : `${r} days ago`;
}
var Ss = Object.defineProperty, Ts = Object.getOwnPropertyDescriptor, z = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? Ts(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && Ss(t, i, o), o;
};
let A = class extends j {
  constructor() {
    super(...arguments), this.bands = [], this.thumbVersion = 0, this.headerText = "Events", this.thumbSize = 0, this.timeSize = 12, this.playingKey = "", this.lastPlayedKey = "", this.expanded = !1, this.gridColumns = 2, this.accent = "#fc9df3", this.hideHead = !1, this.gridThumbWidth = 120, this.dateFontSize = 13, this.itemTextSize = 12, this.captions = !1, this.gridCaptions = !1, this._requested = /* @__PURE__ */ new Set(), this._bandByKey = /* @__PURE__ */ new Map(), this._toggle = async () => {
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
      const o = this._bandByKey.get(s);
      o && this.loader?.get(o), this._io?.unobserve(i.target), t = !0;
    }
    t && this.requestUpdate();
  }
  _observeThumbs() {
    this._io && this.renderRoot.querySelectorAll("[data-key]").forEach((e) => {
      const t = e.dataset.key;
      this._requested.has(t) || this._io.observe(e);
    });
  }
  _fmtTime(e) {
    return new Intl.DateTimeFormat(void 0, {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(e));
  }
  /* Day-divider helpers — same formats as the timeline view's events list. */
  _fmtDay(e) {
    return new Intl.DateTimeFormat(void 0, {
      weekday: "short",
      month: "short",
      day: "numeric"
    }).format(new Date(e));
  }
  _sameDay(e, t) {
    const i = new Date(e), s = new Date(t);
    return i.getFullYear() === s.getFullYear() && i.getMonth() === s.getMonth() && i.getDate() === s.getDate();
  }
  /* Expanded-grid item texts: long time (matches the collapsed list) + duration. */
  _fmtTimeLong(e) {
    return new Intl.DateTimeFormat(void 0, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date(e));
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
  /** One event item — identical in both presentations (the expanded grid only
   *  changes the layout around it, never the item itself). */
  _renderClip(e, t, i) {
    const s = this.playingKey === t || this.expanded && this.lastPlayedKey === t;
    return c`
      <button
        class="clip ${s ? "playing" : ""}"
        @click=${() => this._select(e)}
      >
        <div class="thumb" data-key=${t}>
          ${i ? c`<img src=${i} alt=${e.label} loading="lazy" />` : c`<span class="ph"></span>`}
          <!-- Caption mode moves the time to the line below (with the
               duration); the compact mode overlays it on the footage. -->
          ${this.captions ? v : c`<span class="time">${this._fmtTime(e.start)}</span>`}
        </div>
        <span class="cam">${e.cameraName}</span>
        ${this.captions ? c`<span class="sub"
              >${this._fmtTimeLong(e.start)} ·
              ${e.ongoing ? "In progress" : this._fmtDur(e.durMs ?? e.end - e.start)}</span
            >` : v}
      </button>
    `;
  }
  render() {
    this._bandByKey.clear();
    const e = this.thumbSize > 0 ? `${this.thumbSize}px` : "calc((100% - 12px) / 2)", t = jt(
      this.bands,
      (i) => `${i.type}@${i.start}`,
      (i, s) => {
        const o = `${i.type}@${i.start}`;
        this._bandByKey.set(o, i);
        const r = this._requested.has(o) ? this.loader?.get(i) : void 0, a = this.expanded && (s === 0 || !this._sameDay(this.bands[s - 1].start, i.start));
        return c`
          ${a ? c`<div class="day-divider">
                <span class="day-label">${this._fmtDay(i.start)}</span>
              </div>` : v}
          ${this._renderClip(i, o, r)}
        `;
      }
    );
    return c`
      ${this.hideHead ? v : c`<div class="head">
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
      ${this.bands.length === 0 ? c`<div class="empty">No events</div>` : this.expanded ? c`<div
              class="gridlist"
              style="--upc-egrid-cols:${this.gridColumns};--upc-egrid-w:${this.gridThumbWidth}px;--upc-egrid-date:${this.dateFontSize}px;--upc-egrid-item:${this.itemTextSize}px;--upc-egrid-sub:${Math.max(1, this.itemTextSize - 1)}px;--upc-strip-time:${this.timeSize}px;--upc-strip-divider:${this.accent}"
            >
              ${t}
            </div>` : c`<div
              class="strip"
              style="--upc-strip-thumb:${e};--upc-strip-time:${this.timeSize}px;--upc-egrid-item:${this.itemTextSize}px;--upc-egrid-sub:${Math.max(
      1,
      this.itemTextSize - 1
    )}px"
            >
              ${t}
            </div>`}
      ${v}
    `;
  }
};
A.styles = st`
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
z([
  h({ attribute: !1 })
], A.prototype, "bands", 2);
z([
  h({ attribute: !1 })
], A.prototype, "loader", 2);
z([
  h({ type: Number })
], A.prototype, "thumbVersion", 2);
z([
  h()
], A.prototype, "headerText", 2);
z([
  h({ type: Number })
], A.prototype, "thumbSize", 2);
z([
  h({ type: Number })
], A.prototype, "timeSize", 2);
z([
  h()
], A.prototype, "playingKey", 2);
z([
  h()
], A.prototype, "lastPlayedKey", 2);
z([
  h({ type: Boolean, reflect: !0 })
], A.prototype, "expanded", 2);
z([
  h({ type: Number })
], A.prototype, "gridColumns", 2);
z([
  h()
], A.prototype, "accent", 2);
z([
  h({ type: Boolean })
], A.prototype, "hideHead", 2);
z([
  h({ type: Number })
], A.prototype, "gridThumbWidth", 2);
z([
  h({ type: Number })
], A.prototype, "dateFontSize", 2);
z([
  h({ type: Number })
], A.prototype, "itemTextSize", 2);
z([
  h({ type: Boolean, reflect: !0 })
], A.prototype, "captions", 2);
z([
  h({ type: Boolean, reflect: !0 })
], A.prototype, "gridCaptions", 2);
z([
  U(".strip")
], A.prototype, "_stripEl", 2);
A = z([
  ot("upc-event-strip")
], A);
var Ps = Object.defineProperty, Cs = Object.getOwnPropertyDescriptor, I = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? Cs(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && Ps(t, i, o), o;
};
const ve = 0;
let D = class extends j {
  constructor() {
    super(...arguments), this.entries = [], this.stacked = !1, this.newest = {}, this.minuteTick = 0, this.columns = 2, this.scrollMode = !1, this.aspect = "16/9", this.padTop = 0, this._streamReady = !1, this._boxW = 0, this._boxH = 0, this._fullscreen = (e, t) => {
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
    }), this._ro.observe(this);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._ro?.disconnect(), Lt(this.renderRoot);
  }
  /** Aspect "16/9" -> 16/9 (safe fallback on garbage). */
  _ratio() {
    const [e, t] = this.aspect.split("/").map((i) => parseFloat(i));
    return e > 0 && t > 0 ? e / t : 16 / 9;
  }
  /** Tile width that fits `columns` per row AND all rows in the box height. */
  _tileWidth(e) {
    const t = Math.max(1, this.entries.length), i = Math.ceil(t / e), s = this._boxW || 320, o = this._boxH || 240, r = (s - (e - 1) * ve) / e;
    if (this.scrollMode) return Math.max(80, r);
    const a = (o - this.padTop - (i - 1) * ve) / i;
    return Math.max(80, Math.min(r, a * this._ratio()));
  }
  _open(e) {
    this.dispatchEvent(
      new CustomEvent("tile-open", { detail: e, bubbles: !0, composed: !0 })
    );
  }
  _renderTile(e) {
    const t = e.live_camera || e.camera, i = this.hass?.states[t], s = e.name || this.hass?.states[e.camera]?.attributes?.friendly_name || e.camera.split(".")[1] || e.camera, o = this.newest[e.camera];
    return c`
      <div class="tile" role="button" @click=${() => this._open(e)}>
        ${this._streamReady && i ? c`<ha-camera-stream
              .hass=${this.hass}
              .stateObj=${i}
              .controls=${!1}
              .muted=${!0}
              allow-exoplayer
            ></ha-camera-stream>` : c`<div class="connecting">
              ${i ? "Connecting…" : `${t} not found`}
            </div>`}
        <span class="name">${s}</span>
        ${o ? c`<span class="last">${o.label}: ${ks(o.start, Date.now())}</span>` : ""}
        <button class="fs-btn" title="Fullscreen" @click=${(r) => this._fullscreen(r, e)}>
          <ha-icon icon="mdi:fullscreen"></ha-icon>
        </button>
      </div>
    `;
  }
  render() {
    const e = this.stacked ? 1 : this.columns || Math.max(1, this.entries.length), t = this.stacked ? "100%" : `${this._tileWidth(e).toFixed(1)}px`, i = [];
    for (let o = 0; o < this.entries.length; o += e)
      i.push(this.entries.slice(o, o + e));
    const s = this.scrollMode ? 0 : this.padTop;
    return c`
      <div
        class="grid"
        style="--upc-tile-w:${t};--upc-grid-aspect:${this.aspect};--upc-pad-top:${s}px"
      >
        ${i.map((o) => c`<div class="row">${o.map((r) => this._renderTile(r))}</div>`)}
      </div>
    `;
  }
};
D.styles = st`
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
  h({ attribute: !1 })
], D.prototype, "hass", 2);
I([
  h({ attribute: !1 })
], D.prototype, "entries", 2);
I([
  h({ type: Boolean, reflect: !0 })
], D.prototype, "stacked", 2);
I([
  h({ attribute: !1 })
], D.prototype, "newest", 2);
I([
  h({ type: Number })
], D.prototype, "minuteTick", 2);
I([
  h({ type: Number })
], D.prototype, "columns", 2);
I([
  h({ type: Boolean, reflect: !0, attribute: "scrollmode" })
], D.prototype, "scrollMode", 2);
I([
  h()
], D.prototype, "aspect", 2);
I([
  h({ type: Number })
], D.prototype, "padTop", 2);
I([
  f()
], D.prototype, "_streamReady", 2);
I([
  f()
], D.prototype, "_boxW", 2);
I([
  f()
], D.prototype, "_boxH", 2);
D = I([
  ot("upc-live-grid")
], D);
var As = Object.defineProperty, Es = Object.getOwnPropertyDescriptor, W = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? Es(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && As(t, i, o), o;
};
const Ms = 3e4, zs = 2 * 6e4, Fs = 56, Rs = c`<svg viewBox="0 0 24 24">
  <rect x="4" y="5" width="16" height="5.5" rx="1.5"></rect>
  <rect x="4" y="13.5" width="16" height="5.5" rx="1.5"></rect>
</svg>`, Ds = c`<svg viewBox="0 0 24 24">
  <rect x="4" y="5" width="6.6" height="14" rx="1.5"></rect>
  <rect x="13.4" y="5" width="6.6" height="14" rx="1.5"></rect>
</svg>`;
let L = class extends j {
  constructor() {
    super(...arguments), this.stacked = !1, this._data = /* @__PURE__ */ new Map(), this._strip = [], this._expanded = !1, this._lastPlayedKey = "", this._minuteTick = 0, this._thumbVersion = 0, this._gridView = 2, this._loader = new De(2, () => {
      this._thumbVersion++;
    }), this._lastSyncTrigger = 0, this._fetchSeq = 0, this._onStripSelect = (e) => {
      this._playback = e.detail, this._lastPlayedKey = `${e.detail.type}@${e.detail.start}`;
    }, this._onToggleExpand = async () => {
      if (this.stacked) {
        this._expanded = !this._expanded, this._expanded && (this._playback = void 0);
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
        this._playback = void 0, this._expanded = !0;
    }, this._closePlayback = () => {
      this._playback = void 0;
    }, this._onTileOpen = (e) => {
      const t = e.detail.navigation_path;
      if (t) {
        kt(t);
        return;
      }
      this.dispatchEvent(
        new CustomEvent("camera-open", { detail: e.detail.camera, bubbles: !0, composed: !0 })
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
    super.connectedCallback(), this._refreshTimer = setInterval(() => void this._fetchAll(), Ms), this._minuteTimer = setInterval(() => {
      this._minuteTick++;
    }, 6e4), this.hasUpdated && (this._resetToMain(), this._fetchAll());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), clearInterval(this._refreshTimer), clearInterval(this._minuteTimer), clearTimeout(this._syncRefetchTimer), this._loader.cancelAll(), this._resetToMain();
  }
  /** Return to the default main screen: no clip selected (live grid shown), not
   *  in the expanded events browser, default 2-column density, no last-played
   *  highlight. Used on every (re)entry so the view never resumes mid-clip. */
  _resetToMain() {
    this._playback = void 0, this._expanded = !1, this._lastPlayedKey = "", this._gridView = 2;
  }
  updated(e) {
    e.has("config") && this.config && (this._playback = void 0, this._expanded = !1, this._lastPlayedKey = "", this._fetchAll()), e.has("_expanded") && this._expanded && !this.stacked && this.renderRoot.querySelector(".events-scroll.grid")?.animate(
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
      e.map(async (a) => {
        const n = a.camera.split(".")[1];
        return { e: a, loaded: n ? await Ae(`${Wt}/${n}`) : void 0 };
      })
    );
    if (t !== this._fetchSeq) return;
    const s = (this.config?.event_merge_gap_seconds ?? 60) * 1e3, o = /* @__PURE__ */ new Map();
    let r = !1;
    for (const { e: a, loaded: n } of i)
      (!n || n.stale) && (r = !0), n && o.set(a.camera, {
        bands: xs(Fe(n.entries.map(Ce), s), a.camera, this._name(a)),
        spans: Re(n.entries, n.preMs, n.postMs),
        preMs: n.preMs,
        postMs: n.postMs
      });
    this._data = o, this._strip = $s([...o.values()].map((a) => a.bands)), this._thumbVersion++, r && this._requestSync();
  }
  /** Fire the pyscript sync service (throttled; it syncs ALL cameras) and
   *  re-check the manifests a few seconds later. No-ops without pyscript. */
  _requestSync() {
    if (!this.hass) return;
    const e = Date.now();
    e - this._lastSyncTrigger < zs || (this._lastSyncTrigger = e, this.hass.callWS({ type: "call_service", domain: "pyscript", service: "protect_thumbs_sync" }).catch(() => {
    }), clearTimeout(this._syncRefetchTimer), this._syncRefetchTimer = setTimeout(() => void this._fetchAll(), 8e3));
  }
  // Change the tablet live-grid density (1 = full-width scroll, 2 = columns).
  _setGridView(e) {
    this._gridView = e;
  }
  /** Segmented control that resizes the tablet live grid (1 or 2 columns). */
  _renderGridView(e) {
    const t = (i, s, o) => c`
      <button
        class=${e === i ? "on" : ""}
        title=${s}
        @click=${() => this._setGridView(i)}
      >
        ${o}
      </button>
    `;
    return c`<div class="grid-view">
      ${t(1, "Single column", Rs)} ${t(2, "Two columns", Ds)}
    </div>`;
  }
  render() {
    if (!this.hass || !this.config) return v;
    const e = this._entries(), t = e[0]?.camera ?? "";
    this._loader.configure(
      this.hass,
      this._nvrIdFor(t),
      t,
      this.config.thumbnail_concurrency ?? 2
    );
    const i = this.config.accent_color ?? "#fc9df3", s = this._playback, o = s ? `${s.type}@${s.start}` : "", r = s ? this._data.get(s.camera) : void 0, a = {};
    for (const n of e) a[n.camera] = this._data.get(n.camera)?.bands[0];
    return this.stacked ? c`
      <upc-event-strip
        captions
        .bands=${this._strip}
        .loader=${this._loader}
        .thumbVersion=${this._thumbVersion}
        .headerText=${this.config.strip_title ?? "Events"}
        .thumbSize=${this.config.mobile_events_thumbnail_size ?? 0}
        .timeSize=${this.config.strip_time_size ?? 12}
        .itemTextSize=${(this.config.list_text_size ?? 12) + 1}
        .playingKey=${o}
        .lastPlayedKey=${this._lastPlayedKey}
        .expanded=${this._expanded}
        .gridColumns=${2}
        .accent=${i}
        @strip-select=${this._onStripSelect}
        @toggle-expand=${this._onToggleExpand}
      ></upc-event-strip>
      ${this._expanded ? s ? c`<div class="playoverlay" @click=${this._closePlayback}>
              ${xt(
      o,
      c`<div class="playbox" @click=${(n) => n.stopPropagation()}>
                  ${this._renderPlayer(s, r, i)}
                  <span class="play-cam">${s.cameraName}</span>
                  <button class="live-pill" @click=${this._closePlayback}>✕</button>
                </div>`
    )}
            </div>` : v : c`<div class="body">
        ${s ? xt(
      o,
      c`<div class="playwrap">
                ${this._renderPlayer(s, r, i)}
                <span class="play-cam">${s.cameraName}</span>
                <button class="live-pill" @click=${this._closePlayback}>✕&nbsp;&nbsp;Live</button>
              </div>`
    ) : c`<upc-live-grid
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
    ` : this._renderTablet(e, i, s, o, r, a);
  }
  /** Tablet (wide) layout. Collapsed: the timeline-identical events LIST on the
   *  left (ALL cameras merged) + the live grid (or the clip player) on the right
   *  — click an event to play it on the right. Expanded (chevron): the events
   *  become a full-width grid to browse, cameras unmounted. */
  _renderTablet(e, t, i, s, o, r) {
    const a = this.config, n = a.tablet_events_thumbnail_size ?? 145, l = a.list_text_size ?? 12, p = Math.max(1, l - 1), _ = this._gridView === 1 ? 1 : 2, d = _, g = c`
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
    return this._expanded ? c`
        <div class="tablet expanded">
          <div class="events-pane">
            ${g}
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
                .expanded=${!0}
                .gridThumbWidth=${n}
                .dateFontSize=${a.date_font_size ?? 13}
                .itemTextSize=${l}
                .accent=${t}
                @strip-select=${this._onStripSelect}
              ></upc-event-strip>
            </div>
          </div>
          ${i ? c`<div class="playoverlay" @click=${this._closePlayback}>
                ${xt(
      s,
      c`<div class="playbox" @click=${(b) => b.stopPropagation()}>
                    ${this._renderPlayer(i, o, t)}
                    <span class="play-cam">${i.cameraName}</span>
                    <button class="live-pill" @click=${this._closePlayback}>✕</button>
                  </div>`
    )}
              </div>` : v}
        </div>
      ` : c`
      <div class="tablet">
        <div class="events-pane" style="flex-basis:${n + 168}px">
          ${g}
          <div class="events-scroll">
            <upc-events-list
              .bands=${this._strip}
              .loader=${this._loader}
              .thumbVersion=${this._thumbVersion}
              .textSize=${l}
              .textColor=${a.list_text_color ?? ""}
              .durationSize=${p}
              .durationColor=${a.list_duration_color ?? ""}
              .showCamera=${!0}
              .line1White=${!0}
              .activeTextSize=${a.list_active_text_size ?? 12}
              .activeTextColor=${a.list_active_text_color ?? "#000"}
              .activeDurationSize=${a.list_active_duration_size ?? 12}
              .activeDurationColor=${a.list_active_duration_color ?? "#000"}
              .activeBg=${a.list_active_bg ?? a.list_highlight_color ?? "#fff"}
              .playingKey=${s}
              .dateFontSize=${a.date_font_size ?? 13}
              .dateFontColor=${a.date_font_color ?? "#ffffff"}
              .dividerColor=${t}
              .thumbWidth=${n}
              @event-selected=${this._onStripSelect}
            ></upc-events-list>
          </div>
        </div>
        <div class="body">
          ${i ? xt(
      s,
      c`<div class="playwrap">
                  ${this._renderPlayer(i, o, t)}
                  <span class="play-cam">${i.cameraName}</span>
                  <button class="live-pill" @click=${this._closePlayback}>✕&nbsp;&nbsp;Live</button>
                </div>`
    ) : c`<upc-live-grid
                  .hass=${this.hass}
                  .entries=${e}
                  .stacked=${!1}
                  .newest=${r}
                  .minuteTick=${this._minuteTick}
                  .columns=${_}
                  .scrollMode=${_ === 1}
                  .padTop=${_ === 1 ? 0 : Fs}
                  .aspect=${this.config.grid_aspect ?? "16/9"}
                  @tile-open=${this._onTileOpen}
                  @tile-fullscreen=${this._onTileFs}
                ></upc-live-grid>
                ${this._renderGridView(d)}`}
        </div>
      </div>
    `;
  }
  /** The clip player, identical in both homes: the in-place .playwrap
   *  (collapsed page) and the .playbox lightbox over the expanded grid. */
  _renderPlayer(e, t, i) {
    return c`<upc-media-view
      .hass=${this.hass}
      .nvrId=${this._nvrIdFor(e.camera)}
      .cameraId=${e.camera}
      .gaps=${[]}
      .footageSpans=${t?.spans ?? []}
      .targetTime=${Math.max(e.start - (t?.preMs ?? 0), 0)}
      .clipEndTime=${Math.min(e.end + (t?.postMs ?? 0), Date.now())}
      .scrubbing=${!1}
      .live=${!1}
      .stacked=${this.stacked}
      .chunkSeconds=${this.config.chunk_seconds ?? 300}
      .previewDir=${""}
      .accent=${i}
      .now=${Date.now()}
    ></upc-media-view>`;
  }
};
L.styles = st`
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
W([
  h({ attribute: !1 })
], L.prototype, "hass", 2);
W([
  h({ attribute: !1 })
], L.prototype, "config", 2);
W([
  h({ type: Boolean, reflect: !0 })
], L.prototype, "stacked", 2);
W([
  f()
], L.prototype, "_data", 2);
W([
  f()
], L.prototype, "_strip", 2);
W([
  f()
], L.prototype, "_playback", 2);
W([
  f()
], L.prototype, "_expanded", 2);
W([
  f()
], L.prototype, "_lastPlayedKey", 2);
W([
  f()
], L.prototype, "_minuteTick", 2);
W([
  f()
], L.prototype, "_thumbVersion", 2);
W([
  f()
], L.prototype, "_gridView", 2);
L = W([
  ot("upc-multi-view")
], L);
var Ls = Object.defineProperty, Os = Object.getOwnPropertyDescriptor, T = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? Os(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && Ls(t, i, o), o;
};
const Is = 3e4, Bs = 2 * 6e4, Vs = "2.0.0", Ns = 2e3, Us = 1e3, Ws = 1.3, Hs = 1.15;
let pt = 0, be = "", k = class extends j {
  constructor() {
    super(...arguments), this._gaps = [], this._targetTime = Date.now(), this._scrubbing = !1, this._liveMode = !0, this._livePaused = !1, this._now = Date.now(), this._nvrId = "", this._mode = "timeline", this._activeCamera = "", this._drillFs = !1, this._swapDir = 0, this._playerFs = !1, this._playerRotated = !1, this._galleryOpen = !1, this._calOpen = !1, this._calCursor = { y: 0, m: 0 }, this._hostWidth = 0, this._thumbVersion = 0, this._clipEnd = 0, this._manifestBands = [], this._preMs = 0, this._postMs = 0, this._footageSpans = [], this._lastSyncTrigger = 0, this._loader = new De(2, () => {
      this._thumbVersion++;
    }), this._inited = !1, this._goBack = () => {
      if (this._isMulti && this._drill) {
        this._drillOut();
        return;
      }
      const e = this._config?.back_button_path;
      if (e) {
        kt(e);
        return;
      }
      const t = this._config?.back_fallback_path || `/${window.location.pathname.split("/")[1] ?? ""}`;
      if (window.history.length <= 1) {
        kt(t);
        return;
      }
      const i = window.location.href;
      window.history.back(), window.setTimeout(() => {
        window.location.href === i && this.isConnected && kt(t);
      }, 400);
    }, this._onMediaFsExit = () => {
      this._drillFs && this._drillOut(!0);
    }, this._onPlayerFs = (e) => {
      this._playerFs = e.detail.fs, this._playerRotated = e.detail.rotated;
    }, this._pageBgApplied = !1, this._onVideoPointerDown = (e) => {
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
      const e = new Date(this._domain ? C(this._domain, this._phFrac()) : Date.now());
      this._calCursor = { y: e.getFullYear(), m: e.getMonth() }, this._calOpen = !0, window.addEventListener("pointerdown", this._outsideCalClose, !0);
    }, this._outsideCalClose = (e) => {
      const t = e.composedPath(), i = this.renderRoot.querySelector(".cal-pop"), s = this.renderRoot.querySelector(".date-pill");
      i && t.includes(i) || s && t.includes(s) || (e.preventDefault(), e.stopPropagation(), Be(), this._closeCal());
    }, this._onLivePlaying = (e) => {
      this._livePaused = !e.detail.playing, e.detail.playing && this._liveMode && !this._scrubbing && this._domain && (this._now = Date.now(), this._domain = N(this._now, M(this._domain), this._phFrac()));
    }, this._modeSwapDir = 0, this._showTimeline = () => {
      this._setMode("timeline");
    }, this._showEvents = () => {
      this._setMode("list");
    }, this._onScrubStart = () => {
      clearTimeout(this._scrubSettleTimer), this._scrubbing = !0;
    }, this._onScrubCancel = () => {
      clearTimeout(this._scrubSettleTimer), this._scrubbing = !1;
    }, this._onScrub = (e) => {
      clearTimeout(this._scrubSettleTimer), this._scrubbing = !0, this._liveMode = !1, this._playingBand = void 0, this._clipEnd = 0, this._targetTime = e.detail.time;
    }, this._onScrubEnd = (e) => {
      this._targetTime = e.detail.time, this._playingBand = void 0, clearTimeout(this._scrubSettleTimer);
      const t = () => {
        this._scrubbing = !1, this._clipEnd = 0, this._livePaused = !1, this._liveMode = Date.now() - e.detail.time < 3e3;
      }, i = this._config?.scrub_settle_ms ?? 700;
      i <= 0 ? t() : this._scrubSettleTimer = setTimeout(t, i);
    }, this._onDomainChange = (e) => {
      this._domain = e.detail, this._fetchGaps(!1);
    }, this._onLive = () => {
      if (!this._domain) return;
      clearTimeout(this._scrubSettleTimer), this._now = Date.now();
      const e = this._domain, t = N(this._now, M(e), this._phFrac());
      this._domain = t, this._targetTime = this._now, this._glideRulers(e, t, Us), this._scrubbing = !1, this._liveMode = !0, this._livePaused = !1, this._playingBand = void 0, this._clipEnd = 0;
    }, this._onRewind = (e) => {
      if (!this._domain) return;
      clearTimeout(this._scrubSettleTimer), this._liveMode = !1, this._livePaused = !1, this._scrubbing = !1, this._playingBand = void 0, this._clipEnd = 0, this._targetTime = e.detail.time;
      const t = this._domain, i = N(e.detail.time, M(t), this._phFrac());
      this._domain = i, this._glideRulers(t, i);
    }, this._onPlaybackTime = (e) => {
      if (this._liveMode || this._scrubbing || !this._domain) return;
      const t = this._domain, i = N(e.detail.time, M(t), this._phFrac());
      this._domain = i, Math.abs(
        C(i, this._phFrac()) - C(t, this._phFrac())
      ) >= Ns && this._glideRulers(t, i);
    }, this._onPlaybackSeek = (e) => {
      if (!this._domain) return;
      const t = this._domain, i = N(e.detail.time, M(t), this._phFrac());
      this._domain = i, this._targetTime = e.detail.time, this._glideRulers(t, i);
    }, this._onEventSelected = (e) => {
      this._playBand(e.detail);
    }, this._onClipEnded = () => {
      if (this._playingBand) {
        if (this._mode === "list" && (this._config?.autoplay_next_event ?? !0)) {
          const e = this._nextNewerBand(this._playingBand);
          if (e) {
            this._playBand(e);
            return;
          }
        }
        this._targetTime = this._playingBand.end, this._playingBand = void 0, this._clipEnd = 0;
      }
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
  _drillTo(e, t = !1) {
    this._drill = e, this._drillFs = t, this._activeCamera = e, this._nvrId = this._resolveNvrId(), this._loader.cancelAll(), this._manifestBands = [], this._footageSpans = [], this._gaps = [], this._gapRange = void 0, this._preMs = 0, this._postMs = 0, this._lastSyncTrigger = 0, this._resetToLive(), this._fetchGaps(!0), this._fetchManifest(), this._swapDir = t ? 0 : 1;
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
    return this._playerFs && this._isStacked() ? yi : At;
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
      chunk_seconds: 300,
      delay_seconds: 15,
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
      autoplay_next_event: !0,
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
      scrub_tip: !0,
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
    pt === 0 && (be = t.style.backgroundColor), pt++, t.style.backgroundColor = e, this._pageBgApplied = !0;
  }
  _removePageBackground() {
    this._pageBgApplied && (this._pageBgApplied = !1, pt--, pt <= 0 && (pt = 0, document.documentElement.style.backgroundColor = be));
  }
  connectedCallback() {
    super.connectedCallback(), this._applyPageBackground(), this._tick = setInterval(() => this._onTick(), 1e3), this._bandInterval = setInterval(() => {
      this._isMulti && !this._drill || (this._fetchGaps(!0), this._fetchManifest());
    }, Is), this._hostRo = new ResizeObserver((e) => {
      const t = Math.round(e[e.length - 1].contentRect.width);
      t && t !== this._hostWidth && (this._hostWidth = t);
    }), this._hostRo.observe(this), this.hasUpdated && this._config && !this._isMulti && (this._resetToLive(), this._fetchGaps(!0), this._fetchManifest());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._removePageBackground(), clearInterval(this._tick), clearInterval(this._bandInterval), clearTimeout(this._syncRefetchTimer), clearTimeout(this._scrubSettleTimer), this._hostRo?.disconnect(), window.removeEventListener("pointerdown", this._outsideCalClose, !0), this._loader.cancelAll();
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
    this._mode = "timeline", this._galleryOpen = !1, this._calOpen = !1, this._now = Date.now(), this._domain = N(this._now, this._initialSpan(), this._phFrac()), this._targetTime = this._now, this._scrubbing = !1, this._liveMode = !0, this._livePaused = !1, this._playingBand = void 0, this._clipEnd = 0;
  }
  /** Server-side cache dir: explicit config, else /protect_thumbs/<cam id>.
   *  The explicit dir only applies to the CONFIG camera — when the gallery strip
   *  switched to another camera, its cache dir must be derived from that
   *  camera's object_id or every camera would share one manifest. */
  _cacheDir() {
    if (this._config?.thumbnail_cache_dir && this._activeCamera === this._config.camera)
      return this._config.thumbnail_cache_dir;
    const e = this._activeCamera?.split(".")[1];
    return e ? `${Wt}/${e}` : "";
  }
  /** Scrub-preview cache dir (pyscript protect_scrub job): explicit config for
   *  the CONFIG camera, else /protect_scrub/<object_id> — same per-camera
   *  derivation as _cacheDir. Empty string = preview disabled. */
  _scrubDir() {
    if (this._config?.scrub_preview === !1) return "";
    if (this._config?.scrub_preview_dir && this._activeCamera === this._config.camera)
      return this._config.scrub_preview_dir;
    const e = this._activeCamera?.split(".")[1];
    return e ? `${_i}/${e}` : "";
  }
  /** Load the event manifest (the NVR's own event list, mirrored by the pyscript
   *  sync job). Cheap static file. If it's missing or stale (job not running /
   *  not run yet), ask the sync service to run now — that's the "event exists on
   *  the NVR but isn't cached yet" retrieval path. */
  async _fetchManifest() {
    const e = this._cacheDir();
    if (!e) return;
    const t = this._activeCamera, i = await Ae(e);
    if (t === this._activeCamera) {
      if (i) {
        this._preMs = i.preMs, this._postMs = i.postMs;
        const s = (this._config?.event_merge_gap_seconds ?? 60) * 1e3;
        this._manifestBands = Fe(i.entries.map(Ce), s), this._footageSpans = Re(i.entries, i.preMs, i.postMs), this._thumbVersion++;
      }
      (!i || i.stale) && this._requestSync();
    }
  }
  /** Fire the pyscript sync service (throttled) and re-check the manifest a few
   *  seconds later. No-ops silently when pyscript isn't installed. */
  _requestSync() {
    if (!this.hass) return;
    const e = Date.now();
    e - this._lastSyncTrigger < Bs || (this._lastSyncTrigger = e, this.hass.callWS({ type: "call_service", domain: "pyscript", service: "protect_thumbs_sync" }).catch(() => {
    }), clearTimeout(this._syncRefetchTimer), this._syncRefetchTimer = setTimeout(() => void this._fetchManifest(), 8e3));
  }
  /** Initial visible span: default_timeline_zoom (0–100) wins, else minutes. */
  _initialSpan() {
    const e = this._config?.default_timeline_zoom;
    if (e != null) {
      const t = Math.max(0, Math.min(100, e)), i = Math.round((1 - t / 100) * (O.length - 1));
      return O[i];
    }
    return this._config?.default_span_minutes != null ? xi(this._config.default_span_minutes * it) : O[0];
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
    e !== this._activeCamera && (this._activeCamera = e, this._nvrId = this._resolveNvrId(), this._loader.cancelAll(), this._manifestBands = [], this._footageSpans = [], this._gaps = [], this._gapRange = void 0, this._preMs = 0, this._postMs = 0, this._lastSyncTrigger = 0, this._liveMode || !this._domain ? this._onLive() : (clearTimeout(this._scrubSettleTimer), this._playingBand = void 0, this._clipEnd = 0, this._livePaused = !1, this._scrubbing = !1, this._targetTime = Math.min(C(this._domain, this._phFrac()), Date.now())), this._fetchGaps(!0), this._fetchManifest());
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
    clearTimeout(this._scrubSettleTimer);
    const s = new Date(e, t, i, 0, 0, 0, 0).getTime();
    if (this._mode === "list") {
      this.renderRoot.querySelector("upc-events-list")?.scrollToDay(s);
      const a = s + 864e5;
      if (a > Date.now()) {
        this._onLive();
        return;
      }
      let n;
      for (const l of this._viewBands)
        l.start >= s && l.start < a && (!n || l.start > n.start) && (n = l);
      n && this._playBand(n);
      return;
    }
    const o = new Date(e, t, i, 12, 0, 0, 0).getTime();
    if (o >= Date.now() - 2e4) {
      this._onLive();
      return;
    }
    this._playingBand = void 0, this._clipEnd = 0, this._scrubbing = !1, this._livePaused = !1, this._liveMode = !1, this._targetTime = o, this._domain = N(o, M(this._domain), this._phFrac()), this._fetchGaps(!1);
  }
  // ---- live tick & band fetching -----------------------------------------
  _onTick() {
    this._now = Date.now(), this._liveMode && !this._scrubbing && !this._livePaused && this._domain && (this._domain = N(this._now, M(this._domain), this._phFrac()));
  }
  /** Fetch camera-offline (footage-gap) spans for a large buffer around the
   *  visible window, guard-gated so panning inside the buffer is free. This is
   *  a cheap HA history query, NOT an NVR call. (Events themselves come from
   *  the manifest — see _fetchManifest.) */
  async _fetchGaps(e = !1) {
    if (!this.hass || !this._domain || !(this._config?.show_footage_gaps ?? !0)) return;
    const t = M(this._domain), i = Math.max(t * 2, 180 * it), s = this._domain.start - i, o = Math.min(this._domain.end + i, this._now + 1e3), r = i * 0.5, a = !!this._gapRange && this._domain.start - r >= this._gapRange.start && this._domain.end + r <= this._gapRange.end;
    if (!e && a) return;
    this._gapRange = { start: s, end: o };
    const n = this._activeCamera || this._config.camera, l = await Ri(this.hass, n, s, o, this._nvrId);
    n === this._activeCamera && (this._gaps = l);
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
  /** The next event NEWER than `after` (the row directly above it in the list). */
  _nextNewerBand(e) {
    let t;
    for (const i of this._viewBands)
      i.start > e.start && (!t || i.start < t.start) && (t = i);
    return t;
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
    this._domain && (clearTimeout(this._scrubSettleTimer), this._scrubbing = !1, this._liveMode = !1, this._playingBand = e, this._clipEnd = Math.min(e.end + this._postMs, Date.now()), this._targetTime = Math.max(e.start - this._preMs, 0), this._domain = N(e.start, M(this._domain), this._phFrac()));
  }
  /** The multi-camera page (card_version: multi): same ha-card + header shell
   *  (title, optional back button) as the single card, with <upc-multi-view>
   *  (event strip + live grid / clip playback) filling the rest. */
  _renderMulti() {
    const e = this._config, t = this._isStacked(), i = e.height || (t ? "100dvh" : "80vh"), s = (e.title_font_weight ? `--upc-title-weight:${e.title_font_weight};` : "") + (e.title_font_size ? `--upc-title-size:${e.title_font_size}px;` : "") + (e.title_font_color ? `--upc-title-color:${e.title_font_color};` : "");
    return c`
      <ha-card class=${t ? "multi-stacked" : ""} style=${`height:${i}`}>
        <div class="header" style=${s}>
          ${e.back_button ? c`<button
                class="back-btn"
                aria-label="Back"
                style=${`--upc-back-size:${e.back_button_size ?? 38}px`}
                @click=${this._goBack}
              >
                <ha-icon icon="mdi:chevron-left"></ha-icon>
              </button>` : v}
          <span class="title-text">${e.title ?? "Cameras"}</span>
        </div>
        <upc-multi-view
          .hass=${this.hass}
          .config=${e}
          .stacked=${t}
          @camera-open=${(o) => this._drillTo(o.detail)}
          @camera-fullscreen=${(o) => this._drillTo(o.detail, !0)}
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
    const i = this.hass.states[e.camera]?.attributes?.entity_picture, s = this._galleryOpen ? Math.floor(this._now / 1e4) : 0, o = i ? `${i}${i.includes("?") ? "&" : "?"}upc=${s}` : void 0, r = this._cameraName(e.camera);
    return c`<button
      class="cam-tile ${e.camera === t ? "active" : ""}"
      @click=${() => this._selectCamera(e.camera)}
    >
      ${o ? c`<img src=${o} alt=${r} />` : c`<div class="cam-ph"></div>`}
      <span class="cam-name">${r}</span>
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
    const o = new Date(e, t, 1), r = o.getDay(), a = new Date(e, t + 1, 0).getDate(), n = new Date(this._domain ? C(this._domain, this._phFrac()) : Date.now()), l = ($) => n.getFullYear() === e && n.getMonth() === t && n.getDate() === $, p = new Intl.DateTimeFormat(void 0, {
      month: "long",
      year: "numeric"
    }).format(o), _ = Array.from(
      { length: 7 },
      ($, B) => new Intl.DateTimeFormat(void 0, { weekday: "narrow" }).format(new Date(2023, 0, B + 1))
    ), d = this._mode === "list" ? this._eventDayKeys() : void 0, g = !!d && d.size > 0, b = e * 12 + t;
    let x = s.getFullYear() * 12 + s.getMonth();
    if (g) {
      let $ = 1 / 0;
      for (const B of d) B < $ && ($ = B);
      x = Math.floor($ / 1e4) * 12 + Math.floor($ % 1e4 / 100);
    }
    const F = b > x, H = b < i.getFullYear() * 12 + i.getMonth(), q = [];
    for (let $ = 0; $ < r; $++) q.push(c`<span class="cal-cell"></span>`);
    for (let $ = 1; $ <= a; $++) {
      const B = new Date(e, t, $), Y = g ? d.has(e * 1e4 + t * 100 + $) : B <= i && B >= s;
      q.push(
        c`<button
          class="cal-cell cal-day ${l($) ? "sel" : ""}"
          ?disabled=${!Y}
          @click=${() => this._selectCalDay(e, t, $)}
        >
          ${$}
        </button>`
      );
    }
    return c`<div class="cal-pop ${this._isStacked() ? "" : "wide"}">
      <div class="cal-head">
        <span class="cal-title">${p}</span>
        <span>
          <button class="cal-chev" ?disabled=${!F} @click=${() => this._calShift(-1)}>
            <ha-icon icon="mdi:chevron-left"></ha-icon>
          </button>
          <button class="cal-chev" ?disabled=${!H} @click=${() => this._calShift(1)}>
            <ha-icon icon="mdi:chevron-right"></ha-icon>
          </button>
        </span>
      </div>
      <div class="cal-grid">
        ${_.map(($) => c`<span class="cal-cell cal-wk">${$}</span>`)}
        ${q}
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
    const t = this._config, i = t.tick_size, s = typeof i == "number" ? i : { small: 4, medium: 8, large: 14 }[i ?? "medium"] ?? 8, o = this._isStacked();
    return c`
      <upc-scrubber-timeline
        slot=${e ? "fs-timeline" : v}
        ?mirror=${e}
        .zoomUi=${!0}
        .gutter=${e ? this._fsGutter() : 0}
        .rotated=${e && this._playerRotated}
        .liveArrow=${e}
        .compact=${o}
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
      (t.timeline_font_size ?? 12) * (e ? o ? Hs : Ws : 1)
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
        .indent=${e ? 0 : o ? 75 : 60}
        .pillIndent=${e ? 0 : o ? 35 : 0}
        @scrub-start=${this._onScrubStart}
        @scrub=${this._onScrub}
        @scrub-end=${this._onScrubEnd}
        @scrub-cancel=${this._onScrubCancel}
        @domain-change=${this._onDomainChange}
      ></upc-scrubber-timeline>
    `;
  }
  render() {
    if (!this._config) return v;
    if (this._isMulti && !this._drill) return this._renderMulti();
    if (!this._domain) return c`<ha-card><div class="header">Loading…</div></ha-card>`;
    if (!this._nvrId)
      return c`
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
    const i = this._config.accent_color ?? "#fc9df3", s = this._config.fs_timeline ?? !0, o = this._isStacked(), r = this._config.fs_timeline_width ?? (o ? 120 : 165), a = this._fsPad(), n = this._fsGutter(), l = this._config.fs_timeline_grab_width ?? 0, p = this._config.fs_timeline_scrim ?? 0.88, _ = this._config.fs_timeline_scrim_extend ?? (o ? 130 : 170), d = new Intl.DateTimeFormat(void 0, {
      month: "short",
      day: "numeric"
    }).format(new Date(C(this._domain, this._phFrac()))), g = this._isStacked(), b = this._config.tablet_events_thumbnail_size ?? 145, x = this._config.list_text_size ?? 12, F = Math.max(1, x - 1), H = b + 168, q = (g ? "" : `flex-basis:${H}px;min-width:${H}px;`) + `--upc-accent:${i};--upc-arrow:${this._config.arrow_color ?? "rgba(0,0,0,0.6)"};--upc-arrow-bottom:${this._config.live_arrow_bottom ?? 14}px;--upc-date-size:${this._config.date_font_size ?? 13}px;--upc-date-color:${this._config.date_font_color ?? "#ffffff"};`, $ = this._cameraEntries(), B = $.length ? this._cameraName(e) : this._config.title ?? "UniFi Protect Timeline", Y = this._config.video_ratio ?? 0.45, vt = Math.max(15, Math.min(85, Y > 1 ? Y : Y * 100)), ht = `height:${this._config.height || (g ? "100dvh" : "80vh")}`, V = g ? `--upc-video-frac:${vt}%` : "", S = this._config.list_divider_color || i, R = (this._config.toggle_bg ? `--upc-toggle-bg:${this._config.toggle_bg};` : "") + (this._config.toggle_active_bg ? `--upc-toggle-active-bg:${this._config.toggle_active_bg};` : "") + (this._config.toggle_active_color ? `--upc-toggle-active-color:${this._config.toggle_active_color};` : "") + (this._config.toggle_text_color ? `--upc-toggle-text:${this._config.toggle_text_color};` : ""), G = g && this._config.video_aspect ? `flex:0 0 auto;aspect-ratio:${this._config.video_aspect};width:100%;` : "", K = ($.length ? `--upc-title-weight:${this._config.camera_name_font_weight ?? 600};` : this._config.title_font_weight ? `--upc-title-weight:${this._config.title_font_weight};` : "") + (this._config.title_font_size ? `--upc-title-size:${this._config.title_font_size}px;` : "") + (this._config.title_font_color ? `--upc-title-color:${this._config.title_font_color};` : "");
    return c`
      <ha-card style=${ht}>
        <div class="header" style=${K}>
          ${this._config.back_button || this._drill ? c`<button
                class="back-btn"
                aria-label="Back"
                style=${`--upc-back-size:${this._config.back_button_size ?? 38}px`}
                @click=${this._goBack}
              >
                <ha-icon icon="mdi:chevron-left"></ha-icon>
              </button>` : v}
          <span class="title-text">${B}</span>
          ${$.length ? c`<button
                class="strip-toggle"
                @click=${this._toggleGallery}
                title=${this._galleryOpen ? "Hide cameras" : "Show cameras"}
              >
                <ha-icon
                  icon=${this._galleryOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                ></ha-icon>
              </button>` : v}
        </div>

        ${$.length ? c`<div
              class="cam-strip ${this._galleryOpen ? "open" : ""}"
              style="--upc-cam-tile-w:${b}px"
            >
              <div class="cam-strip-inner">
                ${$.map((Ve) => this._renderCamTile(Ve, e))}
              </div>
            </div>` : v}

        <div class="row ${g ? "stacked" : ""}" style=${V}>
          <div class="timeline-col" style=${q}>
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
              ${this._mode === "timeline" ? this._renderScrubber(!1) : c`
                    <upc-events-list
                      .bands=${this._viewBands}
                      .loader=${this._loader}
                      .thumbVersion=${this._thumbVersion}
                      .textSize=${x}
                      .textColor=${this._config.list_text_color ?? ""}
                      .durationSize=${F}
                      .durationColor=${this._config.list_duration_color ?? ""}
                      .thumbWidth=${b}
                      .line1White=${!0}
                      .activeTextSize=${this._config.list_active_text_size ?? 12}
                      .activeTextColor=${this._config.list_active_text_color ?? "#000"}
                      .activeDurationSize=${this._config.list_active_duration_size ?? 12}
                      .activeDurationColor=${this._config.list_active_duration_color ?? "#000"}
                      .activeBg=${this._config.list_active_bg ?? this._config.list_highlight_color ?? "#fff"}
                      .playingKey=${this._playingBand ? `${this._playingBand.type}@${this._playingBand.start}` : ""}
                      .dateFontSize=${this._config.date_font_size ?? 13}
                      .dateFontColor=${this._config.date_font_color ?? "#ffffff"}
                      .dividerColor=${S}
                      @event-selected=${this._onEventSelected}
                    ></upc-events-list>
                  `}
            </div>

            <button class="date-pill" @click=${this._toggleCal} title="Jump to date">
              <ha-icon icon="mdi:calendar-month-outline"></ha-icon>
              <span>${d}</span>
            </button>
            ${this._calOpen ? this._renderCalendar() : v}
            ${this._mode === "timeline" && !this._liveMode ? c`<button class="live-arrow" @click=${this._onLive} title="Jump to live">
                  ↑
                </button>` : v}
          </div>

          <div
            class="video-col"
            style=${G}
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
              .chunkSeconds=${this._config.chunk_seconds ?? 300}
              .previewDir=${this._scrubDir()}
              .tipEnabled=${this._config.scrub_tip !== !1}
              .footageSpans=${this._footageSpans}
              .accent=${i}
              .clipEndTime=${this._clipEnd}
              .now=${this._now}
              .delaySeconds=${this._config.delay_seconds ?? 15}
              .startFs=${this._drillFs}
              .fsTimeline=${s}
              .fsTimelineWidth=${r}
              .fsTimelinePadding=${a}
              .fsTimelineGutter=${n}
              .fsTimelineGrabWidth=${l}
              .fsTimelineScrim=${p}
              .fsTimelineScrimExtend=${_}
              @playback-time=${this._onPlaybackTime}
        @playback-seek=${this._onPlaybackSeek}
              @clip-ended=${this._onClipEnded}
              @live-playing=${this._onLivePlaying}
              @go-live=${this._onLive}
              @rewind=${this._onRewind}
              @fs-exit=${this._onMediaFsExit}
              @fs-change=${this._onPlayerFs}
            >
              ${s && this._playerFs ? this._renderScrubber(!0) : v}
            </upc-media-view>
          </div>
        </div>
      </ha-card>
    `;
  }
};
k.styles = st`
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
  h({ attribute: !1 })
], k.prototype, "hass", 2);
T([
  f()
], k.prototype, "_config", 2);
T([
  f()
], k.prototype, "_domain", 2);
T([
  f()
], k.prototype, "_gaps", 2);
T([
  f()
], k.prototype, "_targetTime", 2);
T([
  f()
], k.prototype, "_scrubbing", 2);
T([
  f()
], k.prototype, "_liveMode", 2);
T([
  f()
], k.prototype, "_livePaused", 2);
T([
  f()
], k.prototype, "_now", 2);
T([
  f()
], k.prototype, "_nvrId", 2);
T([
  f()
], k.prototype, "_mode", 2);
T([
  f()
], k.prototype, "_activeCamera", 2);
T([
  f()
], k.prototype, "_drill", 2);
T([
  f()
], k.prototype, "_playerFs", 2);
T([
  f()
], k.prototype, "_playerRotated", 2);
T([
  f()
], k.prototype, "_galleryOpen", 2);
T([
  f()
], k.prototype, "_calOpen", 2);
T([
  f()
], k.prototype, "_calCursor", 2);
T([
  f()
], k.prototype, "_hostWidth", 2);
T([
  f()
], k.prototype, "_thumbVersion", 2);
T([
  f()
], k.prototype, "_playingBand", 2);
T([
  f()
], k.prototype, "_clipEnd", 2);
T([
  f()
], k.prototype, "_manifestBands", 2);
T([
  ui("upc-scrubber-timeline")
], k.prototype, "_timelines", 2);
k = T([
  ot("unifi-protect-timeline-card")
], k);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "unifi-protect-timeline-card",
  name: "UniFi Protect Timeline",
  description: "UniFi Protect-style touch scrubber for camera footage and detections",
  preview: !1
});
console.info(
  `%c UNIFI-PROTECT-TIMELINE-CARD %c v${Vs} `,
  "color:#fff;background:#03a9f4;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px",
  "color:#03a9f4;background:#222;border-radius:0 3px 3px 0;padding:2px 4px"
);
export {
  k as UnifiProtectTimelineCard
};

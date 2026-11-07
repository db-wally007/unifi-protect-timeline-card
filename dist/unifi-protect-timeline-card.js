/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ht = globalThis, Te = Ht.ShadowRoot && (Ht.ShadyCSS === void 0 || Ht.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, Ee = Symbol(), Ve = /* @__PURE__ */ new WeakMap();
let ji = class {
  constructor(t, i, s) {
    if (this._$cssResult$ = !0, s !== Ee) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = i;
  }
  get styleSheet() {
    let t = this.o;
    const i = this.t;
    if (Te && t === void 0) {
      const s = i !== void 0 && i.length === 1;
      s && (t = Ve.get(i)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && Ve.set(i, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const ys = (e) => new ji(typeof e == "string" ? e : e + "", void 0, Ee), ft = (e, ...t) => {
  const i = e.length === 1 ? e[0] : t.reduce((s, o, r) => s + ((a) => {
    if (a._$cssResult$ === !0) return a.cssText;
    if (typeof a == "number") return a;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + a + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(o) + e[r + 1], e[0]);
  return new ji(i, e, Ee);
}, xs = (e, t) => {
  if (Te) e.adoptedStyleSheets = t.map((i) => i instanceof CSSStyleSheet ? i : i.styleSheet);
  else for (const i of t) {
    const s = document.createElement("style"), o = Ht.litNonce;
    o !== void 0 && s.setAttribute("nonce", o), s.textContent = i.cssText, e.appendChild(s);
  }
}, We = Te ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((t) => {
  let i = "";
  for (const s of t.cssRules) i += s.cssText;
  return ys(i);
})(e) : e;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: ks, defineProperty: Ss, getOwnPropertyDescriptor: $s, getOwnPropertyNames: Ts, getOwnPropertySymbols: Es, getPrototypeOf: As } = Object, te = globalThis, qe = te.trustedTypes, Cs = qe ? qe.emptyScript : "", Ms = te.reactiveElementPolyfillSupport, Mt = (e, t) => e, jt = { toAttribute(e, t) {
  switch (t) {
    case Boolean:
      e = e ? Cs : null;
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
} }, Ae = (e, t) => !ks(e, t), je = { attribute: !0, type: String, converter: jt, reflect: !1, useDefault: !1, hasChanged: Ae };
Symbol.metadata ??= Symbol("metadata"), te.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let wt = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, i = je) {
    if (i.state && (i.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((i = Object.create(i)).wrapped = !0), this.elementProperties.set(t, i), !i.noAccessor) {
      const s = Symbol(), o = this.getPropertyDescriptor(t, s, i);
      o !== void 0 && Ss(this.prototype, t, o);
    }
  }
  static getPropertyDescriptor(t, i, s) {
    const { get: o, set: r } = $s(this.prototype, t) ?? { get() {
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
    return this.elementProperties.get(t) ?? je;
  }
  static _$Ei() {
    if (this.hasOwnProperty(Mt("elementProperties"))) return;
    const t = As(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(Mt("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(Mt("properties"))) {
      const i = this.properties, s = [...Ts(i), ...Es(i)];
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
      for (const o of s) i.unshift(We(o));
    } else t !== void 0 && i.push(We(t));
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
    return xs(t, this.constructor.elementStyles), t;
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
      const r = (s.converter?.toAttribute !== void 0 ? s.converter : jt).toAttribute(i, s.type);
      this._$Em = t, r == null ? this.removeAttribute(o) : this.setAttribute(o, r), this._$Em = null;
    }
  }
  _$AK(t, i) {
    const s = this.constructor, o = s._$Eh.get(t);
    if (o !== void 0 && this._$Em !== o) {
      const r = s.getPropertyOptions(o), a = typeof r.converter == "function" ? { fromAttribute: r.converter } : r.converter?.fromAttribute !== void 0 ? r.converter : jt;
      this._$Em = o;
      const n = a.fromAttribute(i, r.type);
      this[o] = n ?? this._$Ej?.get(o) ?? n, this._$Em = null;
    }
  }
  requestUpdate(t, i, s, o = !1, r) {
    if (t !== void 0) {
      const a = this.constructor;
      if (o === !1 && (r = this[t]), s ??= a.getPropertyOptions(t), !((s.hasChanged ?? Ae)(r, i) || s.useDefault && s.reflect && r === this._$Ej?.get(t) && !this.hasAttribute(a._$Eu(t, s)))) return;
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
wt.elementStyles = [], wt.shadowRootOptions = { mode: "open" }, wt[Mt("elementProperties")] = /* @__PURE__ */ new Map(), wt[Mt("finalized")] = /* @__PURE__ */ new Map(), Ms?.({ ReactiveElement: wt }), (te.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ce = globalThis, Ge = (e) => e, Gt = Ce.trustedTypes, Ke = Gt ? Gt.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, Gi = "$lit$", rt = `lit$${Math.random().toFixed(9).slice(2)}$`, Ki = "?" + rt, Ps = `<${Ki}>`, pt = document, Pt = () => pt.createComment(""), Rt = (e) => e === null || typeof e != "object" && typeof e != "function", Me = Array.isArray, Rs = (e) => Me(e) || typeof e?.[Symbol.iterator] == "function", se = `[ 	
\f\r]`, Tt = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Ye = /-->/g, Xe = />/g, at = RegExp(`>|${se}(?:([^\\s"'>=/]+)(${se}*=${se}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Ze = /'/g, Je = /"/g, Yi = /^(?:script|style|textarea|title)$/i, zs = (e) => (t, ...i) => ({ _$litType$: e, strings: t, values: i }), u = zs(1), ut = Symbol.for("lit-noChange"), b = Symbol.for("lit-nothing"), Qe = /* @__PURE__ */ new WeakMap(), dt = pt.createTreeWalker(pt, 129);
function Xi(e, t) {
  if (!Me(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Ke !== void 0 ? Ke.createHTML(t) : t;
}
const Ls = (e, t) => {
  const i = e.length - 1, s = [];
  let o, r = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", a = Tt;
  for (let n = 0; n < i; n++) {
    const h = e[n];
    let c, d, l = -1, _ = 0;
    for (; _ < h.length && (a.lastIndex = _, d = a.exec(h), d !== null); ) _ = a.lastIndex, a === Tt ? d[1] === "!--" ? a = Ye : d[1] !== void 0 ? a = Xe : d[2] !== void 0 ? (Yi.test(d[2]) && (o = RegExp("</" + d[2], "g")), a = at) : d[3] !== void 0 && (a = at) : a === at ? d[0] === ">" ? (a = o ?? Tt, l = -1) : d[1] === void 0 ? l = -2 : (l = a.lastIndex - d[2].length, c = d[1], a = d[3] === void 0 ? at : d[3] === '"' ? Je : Ze) : a === Je || a === Ze ? a = at : a === Ye || a === Xe ? a = Tt : (a = at, o = void 0);
    const v = a === at && e[n + 1].startsWith("/>") ? " " : "";
    r += a === Tt ? h + Ps : l >= 0 ? (s.push(c), h.slice(0, l) + Gi + h.slice(l) + rt + v) : h + rt + (l === -2 ? n : v);
  }
  return [Xi(e, r + (e[i] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class zt {
  constructor({ strings: t, _$litType$: i }, s) {
    let o;
    this.parts = [];
    let r = 0, a = 0;
    const n = t.length - 1, h = this.parts, [c, d] = Ls(t, i);
    if (this.el = zt.createElement(c, s), dt.currentNode = this.el.content, i === 2 || i === 3) {
      const l = this.el.content.firstChild;
      l.replaceWith(...l.childNodes);
    }
    for (; (o = dt.nextNode()) !== null && h.length < n; ) {
      if (o.nodeType === 1) {
        if (o.hasAttributes()) for (const l of o.getAttributeNames()) if (l.endsWith(Gi)) {
          const _ = d[a++], v = o.getAttribute(l).split(rt), w = /([.?@])?(.*)/.exec(_);
          h.push({ type: 1, index: r, name: w[2], strings: v, ctor: w[1] === "." ? Os : w[1] === "?" ? Is : w[1] === "@" ? Ds : ee }), o.removeAttribute(l);
        } else l.startsWith(rt) && (h.push({ type: 6, index: r }), o.removeAttribute(l));
        if (Yi.test(o.tagName)) {
          const l = o.textContent.split(rt), _ = l.length - 1;
          if (_ > 0) {
            o.textContent = Gt ? Gt.emptyScript : "";
            for (let v = 0; v < _; v++) o.append(l[v], Pt()), dt.nextNode(), h.push({ type: 2, index: ++r });
            o.append(l[_], Pt());
          }
        }
      } else if (o.nodeType === 8) if (o.data === Ki) h.push({ type: 2, index: r });
      else {
        let l = -1;
        for (; (l = o.data.indexOf(rt, l + 1)) !== -1; ) h.push({ type: 7, index: r }), l += rt.length - 1;
      }
      r++;
    }
  }
  static createElement(t, i) {
    const s = pt.createElement("template");
    return s.innerHTML = t, s;
  }
}
function kt(e, t, i = e, s) {
  if (t === ut) return t;
  let o = s !== void 0 ? i._$Co?.[s] : i._$Cl;
  const r = Rt(t) ? void 0 : t._$litDirective$;
  return o?.constructor !== r && (o?._$AO?.(!1), r === void 0 ? o = void 0 : (o = new r(e), o._$AT(e, i, s)), s !== void 0 ? (i._$Co ??= [])[s] = o : i._$Cl = o), o !== void 0 && (t = kt(e, o._$AS(e, t.values), o, s)), t;
}
class Fs {
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
    const { el: { content: i }, parts: s } = this._$AD, o = (t?.creationScope ?? pt).importNode(i, !0);
    dt.currentNode = o;
    let r = dt.nextNode(), a = 0, n = 0, h = s[0];
    for (; h !== void 0; ) {
      if (a === h.index) {
        let c;
        h.type === 2 ? c = new St(r, r.nextSibling, this, t) : h.type === 1 ? c = new h.ctor(r, h.name, h.strings, this, t) : h.type === 6 && (c = new Bs(r, this, t)), this._$AV.push(c), h = s[++n];
      }
      a !== h?.index && (r = dt.nextNode(), a++);
    }
    return dt.currentNode = pt, o;
  }
  p(t) {
    let i = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(t, s, i), i += s.strings.length - 2) : s._$AI(t[i])), i++;
  }
}
class St {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, i, s, o) {
    this.type = 2, this._$AH = b, this._$AN = void 0, this._$AA = t, this._$AB = i, this._$AM = s, this.options = o, this._$Cv = o?.isConnected ?? !0;
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
    t = kt(this, t, i), Rt(t) ? t === b || t == null || t === "" ? (this._$AH !== b && this._$AR(), this._$AH = b) : t !== this._$AH && t !== ut && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Rs(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== b && Rt(this._$AH) ? this._$AA.nextSibling.data = t : this.T(pt.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: i, _$litType$: s } = t, o = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = zt.createElement(Xi(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === o) this._$AH.p(i);
    else {
      const r = new Fs(o, this), a = r.u(this.options);
      r.p(i), this.T(a), this._$AH = r;
    }
  }
  _$AC(t) {
    let i = Qe.get(t.strings);
    return i === void 0 && Qe.set(t.strings, i = new zt(t)), i;
  }
  k(t) {
    Me(this._$AH) || (this._$AH = [], this._$AR());
    const i = this._$AH;
    let s, o = 0;
    for (const r of t) o === i.length ? i.push(s = new St(this.O(Pt()), this.O(Pt()), this, this.options)) : s = i[o], s._$AI(r), o++;
    o < i.length && (this._$AR(s && s._$AB.nextSibling, o), i.length = o);
  }
  _$AR(t = this._$AA.nextSibling, i) {
    for (this._$AP?.(!1, !0, i); t !== this._$AB; ) {
      const s = Ge(t).nextSibling;
      Ge(t).remove(), t = s;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class ee {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, i, s, o, r) {
    this.type = 1, this._$AH = b, this._$AN = void 0, this.element = t, this.name = i, this._$AM = o, this.options = r, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = b;
  }
  _$AI(t, i = this, s, o) {
    const r = this.strings;
    let a = !1;
    if (r === void 0) t = kt(this, t, i, 0), a = !Rt(t) || t !== this._$AH && t !== ut, a && (this._$AH = t);
    else {
      const n = t;
      let h, c;
      for (t = r[0], h = 0; h < r.length - 1; h++) c = kt(this, n[s + h], i, h), c === ut && (c = this._$AH[h]), a ||= !Rt(c) || c !== this._$AH[h], c === b ? t = b : t !== b && (t += (c ?? "") + r[h + 1]), this._$AH[h] = c;
    }
    a && !o && this.j(t);
  }
  j(t) {
    t === b ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Os extends ee {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === b ? void 0 : t;
  }
}
class Is extends ee {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== b);
  }
}
class Ds extends ee {
  constructor(t, i, s, o, r) {
    super(t, i, s, o, r), this.type = 5;
  }
  _$AI(t, i = this) {
    if ((t = kt(this, t, i, 0) ?? b) === ut) return;
    const s = this._$AH, o = t === b && s !== b || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, r = t !== b && (s === b || o);
    o && this.element.removeEventListener(this.name, this, s), r && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Bs {
  constructor(t, i, s) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = i, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    kt(this, t);
  }
}
const Us = { I: St }, Ns = Ce.litHtmlPolyfillSupport;
Ns?.(zt, St), (Ce.litHtmlVersions ??= []).push("3.3.3");
const Zi = (e, t, i) => {
  const s = i?.renderBefore ?? t;
  let o = s._$litPart$;
  if (o === void 0) {
    const r = i?.renderBefore ?? null;
    s._$litPart$ = o = new St(t.insertBefore(Pt(), r), r, void 0, i ?? {});
  }
  return o._$AI(e), o;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Pe = globalThis;
let Z = class extends wt {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const i = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Zi(i, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return ut;
  }
};
Z._$litElement$ = !0, Z.finalized = !0, Pe.litElementHydrateSupport?.({ LitElement: Z });
const Hs = Pe.litElementPolyfillSupport;
Hs?.({ LitElement: Z });
(Pe.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const mt = (e) => (t, i) => {
  i !== void 0 ? i.addInitializer(() => {
    customElements.define(e, t);
  }) : customElements.define(e, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Vs = { attribute: !0, type: String, converter: jt, reflect: !1, hasChanged: Ae }, Ws = (e = Vs, t, i) => {
  const { kind: s, metadata: o } = i;
  let r = globalThis.litPropertyMetadata.get(o);
  if (r === void 0 && globalThis.litPropertyMetadata.set(o, r = /* @__PURE__ */ new Map()), s === "setter" && ((e = Object.create(e)).wrapped = !0), r.set(i.name, e), s === "accessor") {
    const { name: a } = i;
    return { set(n) {
      const h = t.get.call(this);
      t.set.call(this, n), this.requestUpdate(a, h, e, !0, n);
    }, init(n) {
      return n !== void 0 && this.C(a, void 0, e, n), n;
    } };
  }
  if (s === "setter") {
    const { name: a } = i;
    return function(n) {
      const h = this[a];
      t.call(this, n), this.requestUpdate(a, h, e, !0, n);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function p(e) {
  return (t, i) => typeof i == "object" ? Ws(e, t, i) : ((s, o, r) => {
    const a = o.hasOwnProperty(r);
    return o.constructor.createProperty(r, s), a ? Object.getOwnPropertyDescriptor(o, r) : void 0;
  })(e, t, i);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function m(e) {
  return p({ ...e, state: !0, attribute: !1 });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ji = (e, t, i) => (i.configurable = !0, i.enumerable = !0, Reflect.decorate && typeof t != "object" && Object.defineProperty(e, t, i), i);
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function tt(e, t) {
  return (i, s, o) => {
    const r = (a) => a.renderRoot?.querySelector(e) ?? null;
    return Ji(i, s, { get() {
      return r(this);
    } });
  };
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
let qs;
function js(e) {
  return (t, i) => Ji(t, i, { get() {
    return (this.renderRoot ?? (qs ??= document.createDocumentFragment())).querySelectorAll(e);
  } });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Gs = { CHILD: 2 }, Re = (e) => (...t) => ({ _$litDirective$: e, values: t });
let ze = class {
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
const { I: Ks } = Us, ti = (e) => e, ei = (e, t) => e?._$litType$ !== void 0, Ys = (e) => e?._$litType$?.h != null, ii = () => document.createComment(""), ht = (e, t, i) => {
  const s = e._$AA.parentNode, o = t === void 0 ? e._$AB : t._$AA;
  if (i === void 0) {
    const r = s.insertBefore(ii(), o), a = s.insertBefore(ii(), o);
    i = new Ks(r, a, e, e.options);
  } else {
    const r = i._$AB.nextSibling, a = i._$AM, n = a !== e;
    if (n) {
      let h;
      i._$AQ?.(e), i._$AM = e, i._$AP !== void 0 && (h = e._$AU) !== a._$AU && i._$AP(h);
    }
    if (r !== o || n) {
      let h = i._$AA;
      for (; h !== r; ) {
        const c = ti(h).nextSibling;
        ti(s).insertBefore(h, o), h = c;
      }
    }
  }
  return i;
}, nt = (e, t, i = e) => (e._$AI(t, i), e), Xs = {}, Kt = (e, t = Xs) => e._$AH = t, ve = (e) => e._$AH, oe = (e) => {
  e._$AR(), e._$AA.remove();
}, Zs = (e) => {
  e._$AR();
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const si = (e) => Ys(e) ? e._$litType$.h : e.strings, Js = Re(class extends ze {
  constructor(e) {
    super(e), this.et = /* @__PURE__ */ new WeakMap();
  }
  render(e) {
    return [e];
  }
  update(e, [t]) {
    const i = ei(this.it) ? si(this.it) : null, s = ei(t) ? si(t) : null;
    if (i !== null && (s === null || i !== s)) {
      const o = ve(e).pop();
      let r = this.et.get(i);
      if (r === void 0) {
        const a = document.createDocumentFragment();
        r = Zi(b, a), r.setConnected(!1), this.et.set(i, r);
      }
      Kt(r, [o]), ht(r, void 0, o);
    }
    if (s !== null) {
      if (i === null || i !== s) {
        const o = this.et.get(s);
        if (o !== void 0) {
          const r = ve(o).pop();
          Zs(e), ht(e, void 0, r), Kt(e, [r]);
        }
      }
      this.it = t;
    } else this.it = void 0;
    return this.render(t);
  }
}), Qs = 5 * 6e4, oi = /* @__PURE__ */ new Map();
async function Le(e, t, i, s = fetch) {
  const o = async (h) => {
    const c = await s(h, { cache: "no-cache" });
    return c.ok ? await c.json() : void 0;
  }, r = await o(e);
  if (r === void 0) return;
  const a = t(r);
  if (a === void 0 || Date.now() - a <= i) return r;
  const n = Date.now();
  if (n - (oi.get(e) ?? 0) < Qs) return r;
  oi.set(e, n);
  try {
    const h = await o(`${e}${e.includes("?") ? "&" : "?"}fresh=${n}`);
    if (h !== void 0 && (t(h) ?? 0) > a) return h;
  } catch {
  }
  return r;
}
const to = "/protect_scrub", Fe = "/protect_thumbs", ri = "/local/protect_thumbs";
function eo(e) {
  return e.startsWith(`${ri}/`) ? Fe + e.slice(ri.length) : e;
}
function io(e) {
  return (e instanceof Date ? e : new Date(e)).toISOString();
}
function so(e, t, i, s) {
  let o = `/api/unifiprotect/snapshot/${encodeURIComponent(e)}/${encodeURIComponent(
    t
  )}/${encodeURIComponent(io(i))}`;
  const r = [];
  return r.push(`width=${Math.round(s.width)}`), s?.height && r.push(`height=${Math.round(s.height)}`), r.length && (o += `?${r.join("&")}`), o;
}
async function Yt(e, t, i = 300) {
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
const ai = 3 * 6e4, oo = {
  motion: { label: "Motion", color: "#5c8aff" },
  person: { label: "Person", color: "#3ddc84" },
  vehicle: { label: "Vehicle", color: "#ffb300" },
  animal: { label: "Animal", color: "#ab47bc" }
};
function Qi(e) {
  const t = oo[e.kind] ?? {
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
    file: e.file ? eo(e.file) : void 0,
    durMs: e.dur,
    ongoing: e.ongoing
  };
}
async function ts(e) {
  try {
    const t = await Le(
      `${e}/manifest.json`,
      (i) => Array.isArray(i) ? void 0 : i?.generated,
      ai
    );
    if (!t) return;
    if (Array.isArray(t))
      return { entries: t, preMs: 0, postMs: 0, stale: !0 };
    if (t && Array.isArray(t.events))
      return {
        entries: t.events,
        preMs: t.pre_ms ?? 0,
        postMs: t.post_ms ?? 0,
        stale: Date.now() - (t.generated ?? 0) > ai
      };
  } catch {
  }
}
const es = 1e3, $t = 60 * es, ro = 60 * $t, ge = 4 * $t, is = 60 * $t, q = (() => {
  const t = Math.pow(is / ge, 0.034482758620689655);
  return Array.from({ length: 30 }, (i, s) => Math.round(ge * Math.pow(t, s)));
})(), ie = 0.15, ao = 0.179;
function L(e) {
  return e.end - e.start;
}
function no(e) {
  return Math.min(is, Math.max(ge, e));
}
function A(e, t = ie) {
  return e.end - L(e) * t;
}
const ho = $t, lo = 6 * ro;
function j(e, t, i = ie) {
  const s = Math.min(lo, Math.max(ho, t)), o = e + s * i;
  return { start: o - s, end: o };
}
function co(e, t) {
  let i = 0, s = 1 / 0;
  for (let r = 0; r < q.length; r++) {
    const a = Math.abs(q[r] - e);
    a < s && (s = a, i = r);
  }
  const o = Math.min(q.length - 1, Math.max(0, i + t));
  return q[o];
}
function ni(e, t) {
  const i = -new Date(e.start).getTimezoneOffset() * 6e4, s = Math.ceil((e.start + i) / t) * t - i, o = [];
  for (let r = s; r <= e.end; r += t) o.push(r);
  return o;
}
const po = 2 * 6e4;
function uo(e) {
  if (!e) return [];
  const t = [];
  typeof e.recording_start == "number" && e.recording_start > 0 && t.push({ start: 0, end: e.recording_start });
  for (const i of Array.isArray(e.gaps) ? e.gaps : []) {
    if (!Array.isArray(i) || i.length !== 2) continue;
    const [s, o] = i;
    typeof s == "number" && typeof o == "number" && o > s && t.push({ start: s, end: o });
  }
  return t.sort((i, s) => i.start - s.start);
}
function hi(e) {
  return e[0]?.start === 0 ? e[0].end : void 0;
}
function li(e, t, i, s) {
  const o = [];
  let r = t;
  for (const h of e)
    if (!(h.end < r)) {
      if (h.start > i) break;
      h.start > r && o.push([r, h.start]), r = Math.max(r, h.end);
    }
  r < i && o.push([r, i]);
  const a = o.find(([, h]) => h > s);
  if (a) return Math.max(a[0], s);
  const n = o[o.length - 1];
  return n ? Math.max(n[0], n[1] - 6e4) : void 0;
}
async function _o(e) {
  if (!e) return [];
  try {
    const t = await Le(
      `${e}/index.json`,
      (i) => i.generated,
      po
    );
    return uo(t);
  } catch {
    return [];
  }
}
function ss(e, t) {
  for (const i of e) if (t >= i.start && t <= i.end) return !0;
  return !1;
}
const fo = 2e3, be = 3e3;
let _t = null, it = [], re = !1, At = null;
const ci = /* @__PURE__ */ new Set();
function ot() {
  return _t != null;
}
function mo() {
  if (_t)
    return yt || (yt = os()), yt;
}
function P(e, t = {}) {
  _t && (it.push({ t: Date.now(), ev: e, ...t }), it.length > be && it.splice(0, it.length - be));
}
function vo(e) {
  const t = !_t;
  _t = e, t && (At = bo(), P("page", { path: location.pathname + location.hash, visible: document.visibilityState }), window.setInterval(() => void ae(), fo), document.addEventListener("visibilitychange", () => {
    P("page:visibility", { state: document.visibilityState }), document.visibilityState === "hidden" && ae();
  }), window.addEventListener("pagehide", () => {
    P("page:hide"), ae();
  }));
}
function go(e, t, i, s) {
  if (!_t || !t) return;
  const o = `${t}|${i}x${s}`;
  if (ci.has(o)) return;
  ci.add(o);
  const r = navigator.mediaCapabilities;
  if (!r?.decodingInfo) {
    P("decode", { cam: e, codecs: t, width: i, height: s, api: !1 });
    return;
  }
  const a = t.split(",").find((n) => /^(avc|hvc|hev|av01|vp)/.test(n.trim()))?.trim() ?? t;
  r.decodingInfo({
    type: "media-source",
    video: { contentType: `video/mp4; codecs="${a}"`, width: i, height: s, bitrate: 6e6, framerate: 30 }
  }).then(
    (n) => P("decode", { cam: e, codecs: t, width: i, height: s, supported: n.supported, smooth: n.smooth, powerEfficient: n.powerEfficient }),
    (n) => P("decode", { cam: e, codecs: t, width: i, height: s, error: String(n?.message ?? n) })
  );
}
function os() {
  const e = "upc_debug_client";
  try {
    const o = localStorage.getItem(e);
    if (o) return o;
  } catch {
  }
  const t = navigator.userAgent, s = `${/iPhone/.test(t) ? "iphone" : /iPad/.test(t) ? "ipad" : /Android/.test(t) ? "android" : /Mac/.test(t) ? "mac" : /Linux/.test(t) ? "linux" : "other"}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    localStorage.setItem(e, s);
  } catch {
  }
  return s;
}
function bo() {
  const e = navigator, t = window;
  return {
    ua: navigator.userAgent,
    screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
    viewport: `${innerWidth}x${innerHeight}`,
    cores: navigator.hardwareConcurrency,
    memory: e.deviceMemory,
    net: e.connection ? `${e.connection.effectiveType ?? ""} ${e.connection.downlink ?? ""}` : void 0,
    mms: !!t.ManagedMediaSource,
    mse: !!t.MediaSource,
    secure: window.isSecureContext
  };
}
let yt = "";
async function ae() {
  const e = _t?.();
  if (re || !e || !it.length) return;
  re = !0;
  const t = it;
  it = [], yt || (yt = os());
  const i = { client: yt, sent: Date.now(), events: t };
  At && (i.device = At, At = null);
  try {
    if (e.callApi)
      await e.callApi("POST", "protect_cache/debug", i);
    else if (e.fetchWithAuth) {
      const s = await e.fetchWithAuth("/api/protect_cache/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(i)
      });
      if (!s.ok) throw new Error(`HTTP ${s.status}`);
    }
  } catch {
    it = [...t, ...it].slice(-be), i.device && (At = i.device);
  } finally {
    re = !1;
  }
}
const wo = 50, yo = "/api/protect_talk/ws", di = 1e4, xo = `
class UpcTalk extends AudioWorkletProcessor {
  constructor() {
    super();
    this.n = Math.round(sampleRate / 50);
    this.buf = new Int16Array(this.n);
    this.i = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let k = 0; k < ch.length; k++) {
        const s = Math.max(-1, Math.min(1, ch[k]));
        this.buf[this.i++] = s < 0 ? s * 32768 : s * 32767;
        if (this.i === this.n) {
          this.port.postMessage(this.buf.buffer, [this.buf.buffer]);
          this.buf = new Int16Array(this.n);
          this.i = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('upc-talk', UpcTalk);
`;
function ko(e, t) {
  const i = e?.entities, s = i?.[t]?.device_id;
  if (!i || !s) return !1;
  for (const o in i) {
    const r = i[o];
    if (r.device_id === s && r.platform === "unifiprotect" && o.startsWith("media_player."))
      return !0;
  }
  return !1;
}
class So {
  /** `onEnd` runs once when talking stops for any reason; `error` is a
   *  message for the user when it stopped by itself. */
  constructor(t, i, s, o) {
    this._hass = t, this._nvrId = i, this._cameraId = s, this._onEnd = o, this._ended = !1, this._levels = [], this._levelsAt = 0;
  }
  /** Microphone on, session open, audio flowing. Rejects with a message for
   *  the user (and has already cleaned up) if any step fails. */
  async start() {
    const t = performance.now();
    P("talk:start", { cam: this._cameraId });
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error("Talking needs Home Assistant opened over https");
      const i = new AudioContext();
      this._ctx = i, i.resume();
      let s;
      try {
        s = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: !0,
            noiseSuppression: !0,
            autoGainControl: !0,
            channelCount: 1
          }
        });
      } catch (h) {
        const c = h.name;
        throw new Error(
          c === "NotAllowedError" ? "Microphone access was not allowed" : c === "NotFoundError" ? "No microphone found" : "Could not open the microphone"
        );
      }
      if (this._stream = s, ot()) {
        const h = s.getAudioTracks()[0], c = i;
        P("talk:mic", {
          cam: this._cameraId,
          ms: Math.round(performance.now() - t),
          settings: h?.getSettings?.(),
          label: h?.label,
          ctxRate: i.sampleRate,
          baseLatency: i.baseLatency,
          outputLatency: c.outputLatency,
          state: i.state
        });
      }
      if (this._ended) throw new Error("stopped");
      const o = URL.createObjectURL(new Blob([xo], { type: "application/javascript" }));
      try {
        await i.audioWorklet.addModule(o);
      } finally {
        URL.revokeObjectURL(o);
      }
      const r = await this._open();
      if (r.send(
        JSON.stringify({
          op: "start",
          nvr_id: this._nvrId,
          camera_id: this._cameraId,
          rate: i.sampleRate,
          debug: mo()
          // telemetry: the server logs its side under this id
        })
      ), await this._ready(r), P("talk:ready", { cam: this._cameraId, ms: Math.round(performance.now() - t) }), this._ended) throw new Error("stopped");
      const a = new AudioWorkletNode(i, "upc-talk", { numberOfInputs: 1, numberOfOutputs: 1 }), n = i.createGain();
      n.gain.value = 0, i.createMediaStreamSource(s).connect(a), a.connect(n).connect(i.destination), a.port.onmessage = (h) => {
        if (ot()) {
          this._levels.length || (this._levelsAt = Date.now() - 20);
          const c = new Int16Array(h.data);
          let d = 0;
          for (let _ = 0; _ < c.length; _++) d += c[_] * c[_];
          const l = Math.sqrt(d / Math.max(1, c.length)) / 32768;
          this._levels.push(Math.max(-99, Math.round(20 * Math.log10(l + 1e-9)))), this._levels.length >= wo && this._flushLevels(r.bufferedAmount);
        }
        r.readyState === WebSocket.OPEN && r.send(h.data);
      }, this._node = a, r.onmessage = (h) => {
        const c = typeof h.data == "string" ? JSON.parse(h.data) : {};
        c.ev === "error" ? this.stop(c.message || "Talking failed") : c.ev === "ended" && this.stop(c.reason === "time limit" ? "Talk time limit reached" : void 0);
      }, r.onclose = () => this.stop();
    } catch (i) {
      const s = i.message;
      throw P("talk:failed", { cam: this._cameraId, message: s, ms: Math.round(performance.now() - t) }), this._teardown(), this._ended ? i : (this._ended = !0, new Error(s));
    }
  }
  /** Stop talking (idempotent). */
  stop(t) {
    this._ended || (this._flushLevels(), P("talk:stop", { cam: this._cameraId, error: t }), this._ended = !0, this._teardown(), this._onEnd(t));
  }
  _flushLevels(t) {
    this._levels.length && P("talk:lv", { cam: this._cameraId, at: this._levelsAt, ms: 20, lv: this._levels.splice(0), wsBuf: t });
  }
  _teardown() {
    const t = this._ws;
    if (this._ws = void 0, t) {
      if (t.onclose = null, t.onmessage = null, t.readyState === WebSocket.OPEN)
        try {
          t.send(JSON.stringify({ op: "stop" }));
        } catch {
        }
      try {
        t.close();
      } catch {
      }
    }
    this._node?.port.close(), this._node?.disconnect(), this._node = void 0, this._stream?.getTracks().forEach((i) => i.stop()), this._stream = void 0, this._ctx?.close().catch(() => {
    }), this._ctx = void 0;
  }
  async _open() {
    const t = await Yt(this._hass, yo, 30), i = this._hass.auth?.data?.hassUrl || window.location.origin, s = new URL(t, i);
    s.protocol = s.protocol === "https:" ? "wss:" : "ws:";
    const o = new WebSocket(s.toString());
    return o.binaryType = "arraybuffer", this._ws = o, await new Promise((r, a) => {
      const n = window.setTimeout(() => a(new Error("Talk connection timed out")), di);
      o.onopen = () => {
        clearTimeout(n), r();
      }, o.onclose = () => {
        clearTimeout(n), a(new Error("Talk is not available (is protect_cache up to date?)"));
      };
    }), o;
  }
  /** The server's answer to "start": ready (session open) or an error. */
  _ready(t) {
    return new Promise((i, s) => {
      const o = window.setTimeout(() => s(new Error("The camera did not answer")), di);
      t.onmessage = (r) => {
        if (typeof r.data != "string") return;
        const a = JSON.parse(r.data);
        a.ev === "ready" ? (clearTimeout(o), i()) : (a.ev === "error" || a.ev === "ended") && (clearTimeout(o), s(new Error(a.message || "Talking failed")));
      }, t.onclose = () => {
        clearTimeout(o), s(new Error("Talk connection closed"));
      };
    });
  }
}
function Vt(e) {
  history.pushState(null, "", e), window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: !1 } }));
}
const pi = ["person", "vehicle", "animal", "package", "license plate"];
function ui(e) {
  const t = pi.indexOf(e.label.toLowerCase());
  return t === -1 ? pi.length : t;
}
function rs(e, t) {
  if (t <= 0 || e.length === 0) return e;
  const i = [...e].sort((a, n) => a.start - n.start), s = [];
  let o = [i[0]], r = i[0].end;
  for (let a = 1; a < i.length; a++) {
    const n = i[a];
    n.start - r <= t ? (o.push(n), r = Math.max(r, n.end)) : (s.push(o), o = [n], r = n.end);
  }
  return s.push(o), s.map($o).sort((a, n) => n.start - a.start);
}
function $o(e) {
  const t = e[0];
  if (e.length === 1) return { ...t, members: e };
  const i = e.reduce((a, n) => Math.max(a, n.end), t.end), s = e.reduce((a, n) => ui(n) < ui(a) ? n : a, t), o = e.find((a) => a.file), r = e.some((a) => a.ongoing);
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
const To = 6e4, Eo = 15e3;
class as {
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
    if (ss(this._gaps, t.start)) return;
    const o = this._failed.get(i);
    o !== void 0 && Date.now() - o < To || !this._loading.has(i) && this._hass && this._nvrId && this._cameraId && (this._loading.add(i), this._queue.push(t), this._drain());
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
      const s = t.camera ?? this._cameraId, o = so(this._nvrId, s, t.start, { width: 320 }), r = new AbortController();
      this._controllers.add(r);
      const a = setTimeout(() => r.abort(), Eo);
      Yt(this._hass, o, 600).then((n) => fetch(n, { signal: r.signal })).then((n) => n.ok ? n.blob() : Promise.reject(new Error(`HTTP ${n.status}`))).then((n) => {
        this._store(i, URL.createObjectURL(n)), this._failed.delete(i);
      }).catch(() => {
        this._failed.set(i, Date.now());
      }).finally(() => {
        clearTimeout(a), this._controllers.delete(r), this._active--, this._loading.delete(i), this._drain(), this._onLoaded();
      });
    }
  }
}
const _i = /* @__PURE__ */ new Map();
function Wt(e) {
  const t = JSON.stringify(e);
  let i = _i.get(t);
  return i || (i = new Intl.DateTimeFormat(void 0, e), _i.set(t, i)), i;
}
function xt(e, t) {
  return Wt(t).format(new Date(e));
}
class Ao {
  constructor(t, i, s = () => performance.now(), o = (a, n) => setTimeout(a, n), r = (a) => clearTimeout(a)) {
    this._intervalMs = t, this._emit = i, this._now = s, this._schedule = o, this._cancel = r, this._hasPending = !1, this._lastEmitAt = Number.NEGATIVE_INFINITY;
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
const fi = (e, t, i) => {
  const s = /* @__PURE__ */ new Map();
  for (let o = t; o <= i; o++) s.set(e[o], o);
  return s;
}, Oe = Re(class extends ze {
  constructor(e) {
    if (super(e), e.type !== Gs.CHILD) throw Error("repeat() can only be used in text expressions");
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
    const o = ve(e), { values: r, keys: a } = this.dt(t, i, s);
    if (!Array.isArray(o)) return this.ut = a, r;
    const n = this.ut ??= [], h = [];
    let c, d, l = 0, _ = o.length - 1, v = 0, w = r.length - 1;
    for (; l <= _ && v <= w; ) if (o[l] === null) l++;
    else if (o[_] === null) _--;
    else if (n[l] === a[v]) h[v] = nt(o[l], r[v]), l++, v++;
    else if (n[_] === a[w]) h[w] = nt(o[_], r[w]), _--, w--;
    else if (n[l] === a[w]) h[w] = nt(o[l], r[w]), ht(e, h[w + 1], o[l]), l++, w--;
    else if (n[_] === a[v]) h[v] = nt(o[_], r[v]), ht(e, o[l], o[_]), _--, v++;
    else if (c === void 0 && (c = fi(a, v, w), d = fi(n, l, _)), c.has(n[l])) if (c.has(n[_])) {
      const T = d.get(a[v]), z = T !== void 0 ? o[T] : null;
      if (z === null) {
        const O = ht(e, o[l]);
        nt(O, r[v]), h[v] = O;
      } else h[v] = nt(z, r[v]), ht(e, o[l], z), o[T] = null;
      v++;
    } else oe(o[_]), _--;
    else oe(o[l]), l++;
    for (; v <= w; ) {
      const T = ht(e, h[w + 1]);
      nt(T, r[v]), h[v++] = T;
    }
    for (; l <= _; ) {
      const T = o[l++];
      T !== null && oe(T);
    }
    return this.ut = a, Kt(e, h), ut;
  }
});
var Co = Object.defineProperty, Mo = Object.getOwnPropertyDescriptor, k = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? Mo(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && Co(t, i, o), o;
};
const Po = 62, Ro = 80, mi = 86, vi = 98, lt = 104, zo = 2, Lo = 6, Fo = 8, Oo = 8, ne = 20, Io = 12, Do = 8, Bo = 400, Ct = 16, Uo = 180, No = 400, he = 5, Ho = 24, Vo = 5e3, Wo = 80, qo = 0.325, jo = 20, gi = 4e3, Go = 120, bi = 4, Ko = 3, wi = 48, Ot = 520;
function le(e) {
  return e.id ?? `${e.type}@${e.start}`;
}
function we() {
  const e = (t) => {
    t.stopPropagation(), t.preventDefault();
  };
  window.addEventListener("pointerup", e, { capture: !0, once: !0 }), window.addEventListener("click", e, { capture: !0, once: !0 }), setTimeout(() => {
    window.removeEventListener("pointerup", e, !0), window.removeEventListener("click", e, !0);
  }, 700);
}
function Ie(e, t) {
  const i = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(e.trim());
  if (!i) return "";
  const s = i[1].length === 3 ? i[1].split("").map((a) => a + a).join("") : i[1], o = parseInt(s, 16), r = [o >> 16 & 255, o >> 8 & 255, o & 255].map((a) => Math.round(a * t));
  return `rgb(${r[0]}, ${r[1]}, ${r[2]})`;
}
function Yo(e) {
  const t = $t, i = es;
  return e <= 5 * t ? { major: 1 * t, minor: 15 * i } : e <= 10 * t ? { major: 1 * t, minor: 30 * i } : e <= 20 * t ? { major: 2 * t, minor: 30 * i } : e <= 40 * t ? { major: 5 * t, minor: 1 * t } : e <= 80 * t ? { major: 10 * t, minor: 1 * t } : { major: 10 * t, minor: 1 * t };
}
let x = class extends Z {
  constructor() {
    super(...arguments), this.bands = [], this.gaps = [], this.gapColor = "", this.now = Date.now(), this.nvrId = "", this.cameraId = "", this.fontSize = 11, this.fontColor = "", this.accentColor = "", this.tickColor = "", this.tickSize = 7, this.recordedColor = "", this.futureColor = "", this.thumbSize = 79, this.thumbSizeActive = 95, this.thumbVersion = 0, this.live = !1, this.livePaused = !1, this.indent = 0, this.pillIndent = 0, this.mirror = !1, this.zoomUi = !0, this.rotated = !1, this.liveArrow = !1, this.compact = !1, this.playheadFrac = ie, this.gutter = 0, this._zoomOpen = !1, this._dpr = 1, this._width = 0, this._height = 0, this._pillW = 0, this._setupTs = 0, this._frame = 0, this._evtAnchor = lt, this._hits = [], this._gapHits = [], this._animRaf = 0, this._pointers = /* @__PURE__ */ new Map(), this._dragStartY = 0, this._dragSlop = bi, this._moved = !1, this._gestureStarted = !1, this._gestureScrubbed = !1, this._velSamples = [], this._scrubOpen = !1, this._pillBig = !1, this._glideBig = !1, this._momentumRaf = 0, this._momentumV = 0, this._momentumLast = 0, this._seekRaf = 0, this._reachAnchor = -1, this._onLostCapture = (e) => {
      this._pointers.has(e.pointerId) && (this._pointers.delete(e.pointerId), !this._pointers.size && (this._dragStartDomain = void 0, this._scrubOpen && this._emitScrubEnd()));
    }, this._onPointerDown = (e) => {
      const t = this._scrubEl;
      e.isPrimary && this._pointers.size && this._pointers.clear();
      try {
        t.setPointerCapture(e.pointerId);
      } catch {
      }
      this._refreshRect(), this._cancelMomentum(), this._cancelSeek(), this._velSamples = [], this._gestureScrubbed = !1, this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }), this._moved = !1, this._hoverBand = void 0, this._hoverGap = void 0, this._pointers.size === 2 && (this._moved = !0, this._pinch = { dist: Math.max(1, this._pinchDist()), span: L(this.domain) }, this.dispatchEvent(new CustomEvent("zoom-change", { bubbles: !0, composed: !0 }))), this._pointers.size === 1 && (this._dragStartY = this._localY(e), this._dragStartDomain = { ...this.domain }, this._gestureStarted = !1, this._dragSlop = e.pointerType === "mouse" ? Ko : bi);
    }, this._onPointerMove = (e) => {
      if (this._pointers.size === 0) {
        this._updateHover(e);
        return;
      }
      if (!this._pointers.has(e.pointerId)) return;
      if (this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }), this._pointers.size === 2 && this._pinch) {
        const c = this._pinch.span * this._pinch.dist / Math.max(1, this._pinchDist()), d = Math.min(q[q.length - 1], Math.max(q[0], c));
        this._cancelMomentum(), this._cancelSeek(), this._setDomain(j(A(this.domain, this.playheadFrac), d, this.playheadFrac));
        return;
      }
      if (this._pointers.size !== 1 || !this._dragStartDomain) return;
      const t = this._localY(e);
      if (!this._moved) {
        if (Math.abs(t - this._dragStartY) <= this._dragSlop) return;
        this._moved = !0;
      }
      const i = t - this._dragStartY;
      this._moved && !this._gestureStarted && (this._gestureStarted = !0, this._scrubOpen = !0, this._syncPillBig(), this.dispatchEvent(new CustomEvent("scrub-start", { bubbles: !0, composed: !0 })));
      const s = performance.now();
      for (this._velSamples.push({ t: s, y: t }); this._velSamples.length > 1 && s - this._velSamples[0].t > Go; )
        this._velSamples.shift();
      const o = L(this._dragStartDomain), r = i / (this._height || 1) * o;
      let a = {
        start: this._dragStartDomain.start + r,
        end: this._dragStartDomain.end + r
      };
      const n = this._height || 1, h = A(a, this.playheadFrac) - this.now;
      if (h > 0) {
        const c = h / o * n, l = wi * c / (c + wi) / n * o, _ = h - l;
        if (a = { start: a.start - _, end: a.end - _ }, this._setDomain(a, l), !this._gestureScrubbed) return;
      } else
        this._setDomain(a), this._gestureScrubbed = !0;
      this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: Math.min(A(this.domain, this.playheadFrac), this.now) },
          bubbles: !0,
          composed: !0
        })
      );
    }, this._onPointerUp = (e) => {
      if (!this._pointers.has(e.pointerId)) return;
      const t = this._pointers.size >= 2;
      this._pointers.delete(e.pointerId), this._pointers.size < 2 && (this._pinch = void 0);
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
        if (A(this.domain, this.playheadFrac) > this.now && this._animateFrom({ ...this.domain }, this._applyDomain(j(this.now, L(this.domain), this.playheadFrac))), !this._gestureScrubbed) {
          this._velSamples = [], this._scrubOpen = !1, this._syncPillBig(), this.dispatchEvent(new CustomEvent("scrub-cancel", { bubbles: !0, composed: !0 }));
          return;
        }
        const i = this._releaseVelocity();
        if (!t && Math.abs(i) >= Wo) {
          this._startMomentum(i);
          return;
        }
        this._emitScrubEnd();
      }
    }, this._onPointerLeave = () => {
      this._pointers.size === 0 && (this._clearHover(), this._hoverGap = void 0);
    }, this._onWheel = (e) => {
      e.preventDefault(), this._cancelMomentum(), this._cancelSeek();
      const t = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, i = A(this.domain, this.playheadFrac);
      this._panByPixels(-t), !(t < 0 && i >= this.now - 50 && !this._scrubEndTimer) && (this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: Math.min(A(this.domain, this.playheadFrac), this.now) },
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
      t && e.composedPath().includes(t) || (e.preventDefault(), e.stopPropagation(), we(), this._closeZoom());
    }, this._openZoom = () => {
      this._zoomOpen || (this._zoomOpen = !0, this._emitZoomPanel(), window.addEventListener("pointerdown", this._outsideZoomClose, !0));
    }, this._zoomCloseToken = 0, this._zoomDragging = !1, this._onZoomSliderDown = (e) => {
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
  _holdPillBig(e = Ot) {
    this._glideBig = !0, this._syncPillBig(), clearTimeout(this._pillBigTimer), this._pillBigTimer = setTimeout(() => {
      this._pillBigTimer = void 0, this._glideBig = !1, this._syncPillBig();
    }, e);
  }
  connectedCallback() {
    super.connectedCallback(), this.hasUpdated && this._setup(), this._emitZoomPanel();
  }
  firstUpdated() {
    this._setup();
  }
  /** (Re)bind gestures + ResizeObserver and measure. Safe to call repeatedly. */
  _setup() {
    this._canvas && (this._setupTs = performance.now(), this._dpr = window.devicePixelRatio || 1, this._ro?.disconnect(), this._ro = new ResizeObserver(() => this._resize()), this._ro.observe(this._canvas), this._bindPointer(), this._resize(), requestAnimationFrame(() => requestAnimationFrame(() => this._resize())));
  }
  updated(e) {
    if (x._redrawProps.some((t) => e.has(t)) && this._scheduleDraw(), this.mirror && this._width > 0 && this._width < Bo) {
      const t = this.renderRoot.querySelector(".live-pill")?.offsetWidth ?? 0;
      t && t !== this._pillW && (this._pillW = t, this.requestUpdate());
    } else
      this._pillW = 0;
    if (this.mirror && this._evtAnchor !== this._reachAnchor) {
      const t = this.renderRoot.querySelector(".tl-foot > .live-pill"), i = t?.textContent?.trim() ? t.offsetWidth : 0;
      i && (this._reachAnchor = this._evtAnchor, this.dispatchEvent(
        new CustomEvent("timeline-reach", {
          detail: { px: this._evtAnchor + ne + i },
          bubbles: !0,
          composed: !0
        })
      ));
    }
  }
  // _evtAnchor the last timeline-reach was sent for
  disconnectedCallback() {
    super.disconnectedCallback(), this._zoomOpen = !1, this._zoomCloseToken++, window.removeEventListener("pointerdown", this._outsideZoomClose, !0);
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
    const t = L(this._dd) || 1;
    return (this._dd.end - e) / t * this._height;
  }
  _yToTime(e) {
    const t = L(this._dd) || 1;
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
      const o = i.dataset.key, r = this._kept.find((a) => le(a.m) === o);
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
  /** Start a gesture from a press that landed OUTSIDE the scrub surface — the
   *  fullscreen overlay's margins (media-view's _onStripPress). The pointer is
   *  captured to the surface here, so the rest of the drag arrives as if it
   *  had started on the ruler. */
  beginDrag(e) {
    this._onPointerDown(e);
  }
  _pinchDist() {
    const [e, t] = [...this._pointers.values()];
    return e && t ? Math.hypot(e.x - t.x, e.y - t.y) : 1;
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
    this._momentumV = Math.max(-gi, Math.min(gi, e)), this._momentumLast = performance.now();
    const t = (i) => {
      const s = Math.min(0.1, (i - this._momentumLast) / 1e3);
      this._momentumLast = i, this._panByPixels(this._momentumV * s), this._draw(), this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: A(this.domain, this.playheadFrac) },
          bubbles: !0,
          composed: !0
        })
      ), this._momentumV *= Math.exp(-s / qo);
      const o = this._momentumV > 0 && A(this.domain, this.playheadFrac) >= this.now - 250;
      if (Math.abs(this._momentumV) < jo || o) {
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
    const t = A(this.domain, this.playheadFrac), i = Math.min(e, this.now);
    this._scrubOpen = !0, this._syncPillBig(), this.dispatchEvent(new CustomEvent("scrub-start", { bubbles: !0, composed: !0 }));
    const s = performance.now(), o = (r) => {
      const a = Math.min(1, (r - s) / Ot), n = 1 - Math.pow(1 - a, 3);
      if (this._applyDomain(j(t + (i - t) * n, L(this.domain), this.playheadFrac)), this._draw(), this.dispatchEvent(
        new CustomEvent("scrub", {
          detail: { time: Math.min(A(this.domain, this.playheadFrac), this.now) },
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
    const t = L(this.domain), i = e / (this._height || 1) * t;
    this._setDomain({ start: this.domain.start + i, end: this.domain.end + i });
  }
  _debouncedScrubEnd() {
    clearTimeout(this._scrubEndTimer), this._scrubEndTimer = setTimeout(() => {
      this._scrubEndTimer = void 0, this._emitScrubEnd();
    }, 500);
  }
  _updateHover(e) {
    this._refreshRect();
    const t = this._localY(e), i = this._nearestEvent(t), s = i && i.dist <= Ho ? i.hit.band : void 0, o = s ? this._nearestKeptMember(s, this._yToTime(t)) : void 0;
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
    const t = co(L(this.domain), e);
    this._setSpan(t);
  }
  _setSpan(e) {
    this.dispatchEvent(new CustomEvent("zoom-change", { bubbles: !0, composed: !0 })), this._cancelMomentum(), this._cancelSeek();
    const t = this._animDomain ?? { ...this.domain }, i = this._applyDomain(j(A(this.domain, this.playheadFrac), e, this.playheadFrac));
    this._animateFrom(t, i);
  }
  /** Glide the ruler between two domains without touching the scrub stream —
   *  the HOST calls this when the footage POSITION jumps rather than advances
   *  (the 15s skip buttons), so the ruler scrolls to the new time the same way
   *  tapping an event thumbnail does instead of teleporting. Declined while a
   *  gesture owns the ruler: the finger, a glide or a seek must always win. */
  glideDomain(e, t, i = Ot) {
    this._scrubOpen || this._seekRaf || this._momentumRaf || (this._holdPillBig(i), this._animateFrom(e, t, Ot));
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
    const e = L(this.domain);
    let t = 0, i = 1 / 0;
    return q.forEach((s, o) => {
      const r = Math.abs(s - e);
      r < i && (i = r, t = o);
    }), q.length - 1 - t;
  }
  /** Close the flyout: it shrinks back into the magnifier first (the reverse
   *  of upc-zoom-open), then the magnifier comes back in its place. */
  _closeZoom() {
    if (!this._zoomOpen) return;
    window.removeEventListener("pointerdown", this._outsideZoomClose, !0);
    const e = ++this._zoomCloseToken, t = this.renderRoot.querySelector(".zoom-panel"), i = () => {
      e === this._zoomCloseToken && (this._zoomOpen = !1, this._zoomDragging = !1, this._emitZoomPanel());
    };
    if (!t) return i();
    t.style.pointerEvents = "none";
    const s = this._zoomPanelGeom();
    t.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: `scale(${s.fab / 52}, ${s.fab / s.h})` }
      ],
      { duration: Uo, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }
    ).finished.catch(() => {
    }).then(i);
  }
  /** The zoom slider opened or closed (`zoom-panel`, {open}): the host keeps
   *  what sits beside it out of its way (the phone's events chevron). */
  _emitZoomPanel() {
    this.dispatchEvent(
      new CustomEvent("zoom-panel", { detail: { open: this._zoomOpen }, bubbles: !0, composed: !0 })
    );
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
    const i = t.getBoundingClientRect(), s = Ct, o = this.rotated ? i.width : i.height, r = this.rotated ? i.right - e.clientX : e.clientY - i.top, a = Math.max(1, o - s * 2), n = Math.min(1, Math.max(0, (r - s) / a)), h = Math.round((1 - n) * (q.length - 1));
    h !== this._sliderValue && this._setSpan(q[q.length - 1 - h]);
  }
  /** Commit a domain (clamped so the playhead can't pass `now` — plus an
   *  optional allowance for the rubber-band overshoot); no redraw. */
  _applyDomain(e, t = 0) {
    const i = A(e, this.playheadFrac);
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
        detail: { time: Math.min(A(this.domain, this.playheadFrac), this.now) },
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
      const a = L(this.domain) * (s / o), h = A(this.domain, this.playheadFrac) + a * this.playheadFrac;
      this._applyDomain({ start: h - a, end: h });
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
        labelRight: Po,
        tickRight: Ro,
        trackX0: mi,
        trackX1: vi,
        evtAnchor: lt
      };
    const t = this._width || 1, i = Math.max(2, Math.min(this.tickSize + 5, 18)), s = t - zo, o = s - i - Lo, r = vi - mi, a = Math.max(r, o - e - Fo), n = a - r;
    return { labelRight: o, tickRight: s, trackX0: n, trackX1: a, evtAnchor: t - n + Oo };
  }
  _draw() {
    const e = this._canvas;
    if (!e || !this.domain) return;
    const t = e.getContext("2d");
    if (!t) return;
    const i = this._width, s = this._height;
    t.setTransform(this._dpr, 0, 0, this._dpr, 0, 0), t.clearRect(0, 0, i, s), this.indent && t.translate(this.indent, 0);
    const o = getComputedStyle(this), r = o.getPropertyValue("--secondary-text-color").trim() || "#9aa0a6", a = o.getPropertyValue("--divider-color").trim() || "rgba(255,255,255,0.12)", n = this.accentColor || o.getPropertyValue("--primary-color").trim() || "#03a9f4", h = this.fontSize || 11, c = o.fontFamily || "sans-serif";
    t.font = `${h}px ${c}`;
    const d = this._geo(
      this.mirror ? t.measureText(this._fmt(this._dd.end, { hour: "2-digit", minute: "2-digit" })).width : 0
    );
    this._evtAnchor !== d.evtAnchor && (this._evtAnchor = d.evtAnchor, this.requestUpdate());
    const l = this.recordedColor || a, _ = Math.max(0, Math.min(this._timeToY(this.now), s)), v = d.trackX1 - d.trackX0;
    if (_ > 0 && (this._roundRect(t, d.trackX0, 0, v, _, 3), this.futureColor ? (t.fillStyle = this.futureColor, t.globalAlpha = 1) : (t.fillStyle = l, t.globalAlpha = 0.7), t.fill(), t.globalAlpha = 1), _ < s && (this._roundRect(t, d.trackX0, _, v, s - _, 3), t.fillStyle = l, t.fill()), this._gapHits = [], this.gaps && this.gaps.length) {
      const B = this.gapColor || "#4a4a52";
      t.fillStyle = B, t.globalAlpha = 1;
      for (const y of this.gaps) {
        let S = this._timeToY(y.end), V = this._timeToY(y.start);
        if (!(V < 0 || S > s)) {
          if (V - S < 3) {
            const st = (S + V) / 2;
            S = st - 1.5, V = st + 1.5;
          }
          this._roundRect(t, d.trackX0, S, v, V - S, 3), t.fill(), this._gapHits.push({ gap: y, yTop: S, yBot: V });
        }
      }
    }
    const { major: w, minor: T } = Yo(L(this._dd)), z = this.tickColor || r, O = Math.max(2, Math.min(this.tickSize, 16)), M = Math.max(2, Math.min(this.tickSize + 5, 18)), W = Math.max(1, Math.min(this.tickSize / 5, 2.5));
    t.strokeStyle = z, t.lineWidth = W, t.globalAlpha = 0.7;
    for (const B of ni(this._dd, T)) {
      const y = this._timeToY(B);
      y < 4 || y > s - 4 || (t.beginPath(), t.moveTo(d.tickRight - O, y), t.lineTo(d.tickRight, y), t.stroke());
    }
    t.globalAlpha = 1, t.lineWidth = 1, t.textBaseline = "middle", t.textAlign = "right";
    const G = h * 0.55;
    for (const B of ni(this._dd, w)) {
      const y = this._timeToY(B);
      y < G || y > s - G || (t.strokeStyle = z, t.lineWidth = Math.max(W, 1.5), t.globalAlpha = 0.95, t.beginPath(), t.moveTo(d.tickRight - M, y), t.lineTo(d.tickRight, y), t.stroke(), t.globalAlpha = 1, t.lineWidth = 1, t.fillStyle = this.fontColor || r, t.fillText(this._fmt(B, { hour: "2-digit", minute: "2-digit" }), d.labelRight, y));
    }
    this._hits = [];
    const H = v;
    for (const B of this.bands) {
      let y = this._timeToY(B.end), S = this._timeToY(B.start);
      if (S < 0 || y > s) continue;
      if (S - y < he) {
        const st = (y + S) / 2;
        y = st - he / 2, S = st + he / 2;
      }
      this._hits.push({ band: B, colX: d.trackX1, yTop: y, yBot: S }), t.fillStyle = n;
      const V = Math.min(H / 2, (S - y) / 2);
      t.beginPath(), t.roundRect(d.trackX0, y, H, S - y, V), t.fill();
    }
    t.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    const et = this._playheadY, Y = this.mirror ? Math.max(0, d.trackX0 - 6) : 0;
    t.fillStyle = n, t.globalAlpha = 0.18, t.fillRect(Y, et - 6, i - Y, 12), t.globalAlpha = 1, t.strokeStyle = n, t.lineWidth = 3, t.beginPath(), t.moveTo(Y, et), t.lineTo(i, et), t.stroke(), t.lineWidth = 1;
  }
  _roundRect(e, t, i, s, o, r) {
    const a = Math.max(0, Math.min(r, s / 2, o / 2));
    e.beginPath(), e.moveTo(t + a, i), e.arcTo(t + s, i, t + s, i + o, a), e.arcTo(t + s, i + o, t, i + o, a), e.arcTo(t, i + o, t, i, a), e.arcTo(t, i, t + s, i, a), e.closePath();
  }
  // PERF-SCRUB-2026-08-03: was `new Intl.DateTimeFormat(undefined, opts)` on
  // every call — i.e. once per major tick label per canvas frame, once per frame
  // for the mirror layout's measureText, and once per Lit render for the
  // playhead pill. See data/fmt.ts for the measurements.
  // Revert: `return new Intl.DateTimeFormat(undefined, opts).format(new Date(t));`
  _fmt(e, t) {
    return xt(e, t);
  }
  render() {
    const e = this.accentColor || "var(--primary-color, #03a9f4)", t = Ie(this.accentColor, 0.58), i = this.gutter ? -(this.gutter / 2 + (this.compact ? 19 : 22)) : 8, s = this.live && !this.livePaused && this.domain && this.now - A(this.domain, this.playheadFrac) < Vo, o = !s && this.domain ? this._fmt(Math.min(A(this.domain, this.playheadFrac), this.now), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }) : "", r = this._height > 0 && (s || !!o), a = `--upc-thumb-w:${this.thumbSize}px;--upc-thumb-w-lg:${this.thumbSizeActive}px;`, n = 1 - this._sliderValue / (q.length - 1), h = this._renderThumbs();
    let c = this._evtAnchor + ne + (this._pillDodge() ? this.thumbSizeActive + Io : 0);
    this.mirror && this._pillW > 0 && this._width > 0 && (c = Math.min(c, this._width - this._pillW - Do));
    const d = this.mirror && this.domain ? this._fmt(Math.min(A(this.domain, this.playheadFrac), this.now), {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }) : "";
    return u`
      <div
        class="col"
        style="--upc-accent:${e};${t ? `--upc-accent-deep:${t};` : ""}--upc-indent:${this.indent}px;--upc-pill-left:${this.pillIndent}px;--upc-evt-right:${this._evtAnchor}px;--upc-pill-right:${c}px;--upc-pill-base-right:${this._evtAnchor + ne}px;--upc-fab-right:${i}px;--upc-ph-y:${this._height * this.playheadFrac}px;${a}"
      >
        <div class="scrub">
          <canvas></canvas>
          <div class="evt-layer">${h}</div>
          ${r ? u`<div
                class="live-pill ${s ? "" : "at-time"} ${this._pillBig ? "big" : ""}"
                style="top:${this._height * this.playheadFrac}px"
              >
                ${s ? "LIVE" : o}
              </div>` : b}
          ${this._hoverGap ? u`<div class="gap-tip" style="top:${this._hoverGap.y}px">
                Camera offline
                <div class="gap-sub">
                  ${this._fmt(this._hoverGap.gap.start, { hour: "2-digit", minute: "2-digit" })} –
                  ${this._fmt(this._hoverGap.gap.end, { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>` : b}
          ${this.zoomUi ? this._renderZoom(n) : b}
          ${this.mirror ? u`<div class="tl-foot" @pointerdown=${(l) => l.stopPropagation()}>
                <span class="live-pill at-time">${d}</span>
                <slot name="foot"></slot>
              </div>` : b}
          ${this.liveArrow && !this.live ? u`<button
                class="live-arrow ${this._zoomOpen && this._zoomPanelGeom().long ? "under-zoom" : ""}"
                title="Jump to live"
                @pointerdown=${(l) => l.stopPropagation()}
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
  /** The zoom flyout's length and how it grows out of the magnifier: on the
   *  phone's full-screen ruler (mirror + compact) longer than elsewhere (user,
   *  2026-10-31: "substantially longer") - from the magnifier down to the
   *  strip's foot on a short strip (sideways), half that on a tall one
   *  (upright: the whole length was "a bit extreme"); elsewhere its fixed
   *  length. `fab`: the magnifier's size (the panel's top lines up with its
   *  top); `long`: it reaches the strip's foot, where the live arrow is. */
  _zoomPanelGeom() {
    const e = this.compact && this.mirror ? 38 : 44, t = this.compact ? 206 : 236;
    if (!(this.mirror && this.compact) || !this._height) return { h: t, fab: e, long: !1 };
    const i = this._height * this.playheadFrac - e / 2, s = Math.round(this._height - i - 12), o = Math.max(t, s > No ? Math.round(s / 2) : s);
    return { h: o, fab: e, long: i + o > this._height - 50 };
  }
  /** The collapsible zoom control (magnifier fab -> vertical slider flyout).
   *  Dropped entirely in the fullscreen overlay, which has no zoom. */
  _renderZoom(e) {
    const t = this._zoomPanelGeom(), i = `height:${t.h}px;--zoy:${t.fab / 2}px;--zsx:${(t.fab / 52).toFixed(3)};--zsy:${(t.fab / t.h).toFixed(3)}`;
    return u`
      ${this._zoomOpen ? u`<div class="zoom-panel" style=${i}>
            <button
              class="zpbtn"
              @pointerdown=${(s) => s.stopPropagation()}
              @click=${this._zoomIn}
              title="Zoom in"
            >
              +
            </button>
            <div
              class="zslider ${this._zoomDragging ? "drag" : ""}"
              style="--zpos:${e * 100}%;--zfill:${1 - e}"
              @pointerdown=${this._onZoomSliderDown}
              @pointermove=${this._onZoomSliderMove}
              @pointerup=${this._onZoomSliderUp}
              @pointercancel=${this._onZoomSliderUp}
            >
              <div class="zrail"><div class="zfill"></div></div>
              <div class="zcarrier"><div class="zthumb"></div></div>
            </div>
            <button
              class="zpbtn"
              @pointerdown=${(s) => s.stopPropagation()}
              @click=${this._zoomOut}
              title="Zoom out"
            >
              −
            </button>
          </div>` : u`<button
            class="zoom-fab"
            @pointerdown=${(s) => s.stopPropagation()}
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
    const e = A(this.domain, this.playheadFrac), t = this.thumbSizeActive * 0.75 / 2, i = this.thumbSize * 0.75 / 2, s = t + i + 6, o = L(this._dd), r = this._keptSel;
    let a;
    if (r && r.bands === this.bands && r.span === o && r.height === this._height && r.spacing === s)
      a = r.sel;
    else {
      a = [];
      let l = 1 / 0;
      for (const { m: _, g: v } of this._members()) {
        const w = (this._timeToY(_.end) + this._timeToY(_.start)) / 2;
        l - w < s || (l = w, a.push({ m: _, g: v }));
      }
      this._keptSel = { bands: this.bands, span: o, height: this._height, spacing: s, sel: a };
    }
    const n = a.map(({ m: l, g: _ }) => ({
      m: l,
      g: _,
      y: (this._timeToY(l.end) + this._timeToY(l.start)) / 2
    }));
    this._kept = n;
    let h, c = 1 / 0;
    for (const l of n) {
      if (e < l.g.start || e > l.g.end) continue;
      const _ = e < l.m.start ? l.m.start - e : e > l.m.end ? e - l.m.end : 0;
      _ < c && (c = _, h = l);
    }
    const d = n.filter((l) => {
      const _ = l === h || this._hoverBand === l.m ? t : i;
      return l.y + _ >= 0 && l.y - _ <= this._height;
    });
    return Oe(
      d,
      (l) => le(l.m),
      (l) => {
        const _ = l === h, v = this._hoverBand === l.m, w = this.loader?.get(l.m);
        return u`<div
          class="evt ${_ ? "active" : ""} ${v ? "hovered" : ""}"
          style="top:${l.y}px"
        >
          <span class="evt-line"></span>
          <div
            class="evt-wrap"
            data-key=${le(l.m)}
            @mouseenter=${() => this._setHover(l.m)}
            @mouseleave=${this._clearHover}
          >
            ${w ? u`<img class="evt-thumb" .src=${w} alt=${l.g.label} />` : u`<span class="evt-thumb evt-ph"></span>`}
          </div>
        </div>`;
      }
    );
  }
};
x.styles = ft`
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
       custom slider — native vertical range inputs are unreliable on iOS.
       iOS-style since 2026-10-30 (user: the knob was "too small, not
       animated and hard to control using a finger"): it grows out of the
       magnifier and shrinks back into it (_closeZoom), a thick track fills
       with the accent up to a big white knob that springs from step to step
       and swells while held, and the buttons give under the finger. */
    .zoom-panel {
      position: absolute;
      top: 14px;
      right: 8px;
      margin-right: -4px; /* centred on the magnifier, which is 8px narrower */
      width: 52px;
      /* A FIXED length, not a percentage of the ruler: this is one control and
         it must be the same size wherever it appears, but the card column's
         ruler and the fullscreen one are wildly different heights, so a
         percentage made the in-card flyout markedly the smaller of the two.
         224px is what 35% used to resolve to on a tablet's fullscreen ruler,
         so the overlay there is unchanged and the card column now matches it.
         (Set inline by _zoomPanelGeom - the phone's full screen runs it the
         ruler's length; this is the fallback.) */
      height: 236px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 0;
      box-sizing: border-box;
      border-radius: 26px;
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
      z-index: 9;
      /* It grows out of the magnifier (its top lines up with the panel's):
         from the magnifier's centre and size - set per placement, see
         _zoomPanelGeom. */
      transform-origin: 50% var(--zoy, 22px);
      animation: upc-zoom-open 0.34s cubic-bezier(0.22, 1, 0.36, 1);
    }
    @keyframes upc-zoom-open {
      from {
        opacity: 0;
        transform: scale(var(--zsx, 0.85), var(--zsy, 0.19));
      }
    }
    /* The magnifier coming back as the flyout shrinks into it. */
    .zoom-fab {
      animation: upc-zoom-fab-in 0.26s cubic-bezier(0.22, 1, 0.36, 1);
    }
    @keyframes upc-zoom-fab-in {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
    }
    .zpbtn {
      flex: 0 0 auto;
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 400;
      line-height: 1;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      transition:
        transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
        background 0.25s ease;
    }
    .zpbtn:active {
      transform: scale(0.86);
      background: rgba(255, 255, 255, 0.14);
      transition:
        transform 0.08s ease-out,
        background 0.08s ease-out;
    }
    .zslider {
      position: relative;
      flex: 1 1 auto;
      width: 100%;
      min-height: 60px;
      cursor: pointer;
      touch-action: none;
    }
    /* The track (inset so the knob fits at either end), filled with the
       accent from the bottom up to the knob: how far in it is zoomed. */
    .zrail {
      position: absolute;
      left: 50%;
      top: ${Ct}px;
      bottom: ${Ct}px;
      width: 6px;
      margin-left: -3px;
      border-radius: 3px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.22);
      transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .zfill {
      position: absolute;
      inset: 0;
      background: var(--upc-accent, var(--primary-color, #03a9f4));
      transform-origin: 50% 100%;
      transform: scaleY(var(--zfill, 0));
    }
    /* The knob rides a carrier as tall as the track: translateY in % of the
       carrier is then exactly the knob's place on it (transform only). */
    .zcarrier {
      position: absolute;
      left: 0;
      right: 0;
      top: ${Ct}px;
      bottom: ${Ct}px;
      transform: translateY(var(--zpos, 0%));
      pointer-events: none;
    }
    .zthumb {
      position: absolute;
      left: 50%;
      top: 0;
      width: 30px;
      height: 30px;
      margin: -15px 0 0 -15px;
      border-radius: 50%;
      background: #fff;
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.45),
        0 0 0 0.5px rgba(0, 0, 0, 0.12);
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    /* A step taken by a tap or a button springs there; while dragged the
       knob keeps up with the finger, swollen, the track thicker. */
    .zcarrier,
    .zfill {
      transition: transform 0.38s cubic-bezier(0.34, 1.3, 0.64, 1);
    }
    .zslider.drag .zcarrier,
    .zslider.drag .zfill {
      transition: transform 0.12s ease-out;
    }
    .zslider.drag .zthumb {
      transform: scale(1.2);
    }
    .zslider.drag .zrail {
      transform: scaleX(1.5);
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
      left: calc(${lt}px + var(--upc-indent, 0px));
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
      left: calc(${lt}px + var(--upc-indent, 0px));
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
      right: var(--upc-evt-right, ${lt}px);
    }
    :host([mirror]) .evt {
      flex-direction: row-reverse;
    }
    /* Bigger pill in the overlay — it is read across a room, not at desk
       distance like the card's own column. It rides at --upc-pill-right, which
       steps further left when a thumbnail shares its row (see _pillDodge). */
    :host([mirror]) .live-pill {
      left: auto;
      right: var(--upc-pill-right, ${lt}px);
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
    /* (Centred on the phone's smaller magnifier; its length: _zoomPanelGeom.) */
    :host([mirror][compact]) .zoom-panel {
      margin-right: -7px;
    }
    /* The jump-to-live arrow shares the lane, at its foot: it steps aside
       while the slider runs down over it. */
    .live-arrow {
      transition: opacity 0.2s ease;
    }
    .live-arrow.under-zoom {
      opacity: 0;
      pointer-events: none;
    }
    :host([mirror]) .zoom-fab {
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
    }
    /* The host's slot at the foot of the overlay ruler (the card's date pill):
       level with the jump-to-live arrow across the strip, and centred under
       the playhead pill. The pill is right-anchored with a content width, so
       the foot stacks the slotted element on an invisible copy of it — the
       same box, at the pill's resting spot (not its dodge or its swell) —
       and centres it there. */
    .tl-foot {
      position: absolute;
      right: var(--upc-pill-base-right, ${lt}px);
      bottom: 8px;
      height: 44px; /* the live arrow's row */
      display: grid;
      align-items: center;
      justify-items: center;
      z-index: 9;
      pointer-events: none;
    }
    .tl-foot > .live-pill,
    slot[name='foot']::slotted(*) {
      grid-area: 1 / 1;
    }
    .tl-foot > .live-pill {
      position: static;
      transform: none;
      animation: none;
      visibility: hidden;
    }
    .tl-foot > .live-pill::after {
      display: none;
    }
    slot[name='foot']::slotted(*) {
      pointer-events: auto;
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
x._redrawProps = [
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
k([
  p({ attribute: !1 })
], x.prototype, "domain", 2);
k([
  p({ attribute: !1 })
], x.prototype, "bands", 2);
k([
  p({ attribute: !1 })
], x.prototype, "gaps", 2);
k([
  p()
], x.prototype, "gapColor", 2);
k([
  p({ attribute: !1 })
], x.prototype, "now", 2);
k([
  p({ attribute: !1 })
], x.prototype, "hass", 2);
k([
  p()
], x.prototype, "nvrId", 2);
k([
  p()
], x.prototype, "cameraId", 2);
k([
  p({ type: Number })
], x.prototype, "fontSize", 2);
k([
  p()
], x.prototype, "fontColor", 2);
k([
  p()
], x.prototype, "accentColor", 2);
k([
  p()
], x.prototype, "tickColor", 2);
k([
  p({ type: Number })
], x.prototype, "tickSize", 2);
k([
  p()
], x.prototype, "recordedColor", 2);
k([
  p()
], x.prototype, "futureColor", 2);
k([
  p({ type: Number })
], x.prototype, "thumbSize", 2);
k([
  p({ type: Number })
], x.prototype, "thumbSizeActive", 2);
k([
  p({ attribute: !1 })
], x.prototype, "loader", 2);
k([
  p({ type: Number })
], x.prototype, "thumbVersion", 2);
k([
  p({ type: Boolean })
], x.prototype, "live", 2);
k([
  p({ type: Boolean })
], x.prototype, "livePaused", 2);
k([
  p({ type: Number })
], x.prototype, "indent", 2);
k([
  p({ type: Number })
], x.prototype, "pillIndent", 2);
k([
  p({ type: Boolean, reflect: !0 })
], x.prototype, "mirror", 2);
k([
  p({ type: Boolean })
], x.prototype, "zoomUi", 2);
k([
  p({ type: Boolean })
], x.prototype, "rotated", 2);
k([
  p({ type: Boolean })
], x.prototype, "liveArrow", 2);
k([
  p({ type: Boolean, reflect: !0 })
], x.prototype, "compact", 2);
k([
  p({ type: Number })
], x.prototype, "playheadFrac", 2);
k([
  p({ type: Number })
], x.prototype, "gutter", 2);
k([
  m()
], x.prototype, "_hoverBand", 2);
k([
  m()
], x.prototype, "_hoverGap", 2);
k([
  m()
], x.prototype, "_zoomOpen", 2);
k([
  tt("canvas")
], x.prototype, "_canvas", 2);
k([
  tt(".scrub")
], x.prototype, "_scrubEl", 2);
k([
  m()
], x.prototype, "_pillBig", 2);
k([
  m()
], x.prototype, "_zoomDragging", 2);
x = k([
  mt("upc-scrubber-timeline")
], x);
/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const It = Re(class extends ze {
  constructor() {
    super(...arguments), this.key = b;
  }
  render(e, t) {
    return this.key = e, t;
  }
  update(e, [t, i]) {
    return t !== this.key && (Kt(e), this.key = t), i;
  }
});
function ns(e, t, i) {
  return e.map((s) => ({ ...s, camera: t, cameraName: i }));
}
function Xo(e) {
  return e.flat().sort((t, i) => i.start - t.start);
}
function Zo(e, t) {
  const i = Math.max(0, Math.floor((t - e) / 1e3));
  if (i < 60) return "just now";
  const s = Math.floor(i / 60);
  if (s < 60) return s === 1 ? "1 minute ago" : `${s} minutes ago`;
  const o = Math.floor(s / 60);
  if (o < 24) return o === 1 ? "1 hour ago" : `${o} hours ago`;
  const r = Math.floor(o / 24);
  return r === 1 ? "1 day ago" : `${r} days ago`;
}
const De = typeof navigator < "u" && /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|Android/.test(navigator.userAgent), U = 500, Lt = 240;
function hs(e, t = 0.45) {
  const i = 2 * Math.PI / t, s = [], o = 24;
  for (let r = 0; r <= o; r++) {
    const a = r / o * e / 1e3, n = r === o ? 1 : 1 - (1 + i * a) * Math.exp(-i * a);
    s.push(`${n.toFixed(4)} ${(r / o * 100).toFixed(1)}%`);
  }
  return `linear(${s.join(", ")})`;
}
const ye = hs(U), ls = "cubic-bezier(0.25, 0.8, 0.3, 1)";
let xe;
function X() {
  return xe ??= typeof CSS < "u" && CSS.supports?.("animation-timing-function", ye) === !0, xe ? ye : ls;
}
const Xt = 460, Zt = 300;
function Jo(e, t, i) {
  const s = 2 * Math.PI / t, o = s * Math.sqrt(1 - i * i), r = [], a = 40;
  for (let n = 0; n <= a; n++) {
    const h = n / a * e / 1e3, c = n === a ? 1 : 1 - Math.exp(-i * s * h) * (Math.cos(o * h) + i * s / o * Math.sin(o * h));
    r.push(`${c.toFixed(4)} ${(n / a * 100).toFixed(1)}%`);
  }
  return `linear(${r.join(", ")})`;
}
const Qo = Jo(Xt, 0.36, 0.75), tr = hs(Zt, 0.27), er = 0.6;
function ir(e, t, i, s, o) {
  const r = xe ?? X() === ye, a = { transformOrigin: "0 0", transform: ds(t, i, s) }, n = { transformOrigin: "0 0", transform: "none" };
  return o ? (e.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1 }], { duration: Xt }), e.animate([a, n], {
    duration: Xt,
    easing: r ? Qo : "cubic-bezier(0.34, 1.3, 0.64, 1)"
  })) : (e.animate([{ opacity: 1 }, { opacity: 1, offset: 0.1 }, { opacity: 0, offset: er }, { opacity: 0 }], {
    duration: Zt,
    fill: "forwards"
  }), e.animate([n, a], {
    duration: Zt,
    easing: r ? tr : ls,
    fill: "forwards"
  }));
}
function sr(e, t) {
  const i = ct(e.el, t), s = e.content;
  return { x: i.x + s.x, y: i.y + s.y, w: s.w, h: s.h };
}
function yi(e) {
  return { x: e.left, y: e.top, w: e.width, h: e.height };
}
function ct(e, t) {
  const i = e.getBoundingClientRect(), s = t.getBoundingClientRect();
  return { x: i.left - s.left, y: i.top - s.top, w: i.width, h: i.height };
}
function cs(e, t) {
  const i = e.getBoundingClientRect();
  if (!i.width || !i.height || i.top < -1 || i.bottom > window.innerHeight + 1) return !1;
  if (!t) return !0;
  const s = t.getBoundingClientRect();
  return i.top >= s.top - 1 && i.bottom <= s.bottom + 1 && i.left >= s.left - 1 && i.right <= s.right + 1;
}
function xi(e, t) {
  const i = Math.max(e.x, t.x), s = Math.max(e.y, t.y), o = Math.min(e.x + e.w, t.x + t.w), r = Math.min(e.y + e.h, t.y + t.h);
  return o - i < 1 || r - s < 1 ? null : { x: i, y: s, w: o - i, h: r - s };
}
function or(e, t) {
  if (!(t > 0) || !e.w || !e.h) return e;
  if (e.w / e.h > t) {
    const s = e.h * t;
    return { x: e.x + (e.w - s) / 2, y: e.y, w: s, h: e.h };
  }
  const i = e.w / t;
  return { x: e.x, y: e.y + (e.h - i) / 2, w: e.w, h: i };
}
function ds(e, t, i) {
  const s = Math.min(e.w / Math.max(1, i.w), e.h / Math.max(1, i.h)), o = e.x + e.w / 2 - t.x - s * (i.x + i.w / 2), r = e.y + e.h / 2 - t.y - s * (i.y + i.h / 2);
  return `translate(${o}px, ${r}px) scale(${s})`;
}
function ke(e, t, i, s, o = {}) {
  const r = [
    { transformOrigin: "0 0", transform: ds(t, i, s) },
    { transformOrigin: "0 0", transform: "none" }
  ];
  return o.out && r.reverse(), e.animate(
    o.out ? [{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }],
    { duration: U, fill: o.out ? "forwards" : "none" }
  ), e.animate(r, { duration: U, easing: X(), fill: o.out ? "forwards" : "none" });
}
function rr(e, t, i, s) {
  const o = e.getBoundingClientRect(), r = e.offsetWidth, a = e.offsetHeight, n = Math.min(t.w / Math.max(1, i.w), t.h / Math.max(1, i.h)), h = t.x + t.w / 2 - (o.left + o.width / 2) - n * (i.x + i.w / 2 - r / 2), c = t.y + t.h / 2 - (o.top + o.height / 2) - n * (i.y + i.h / 2 - a / 2);
  return [
    { transformOrigin: "50% 50%", transform: `translate(${h}px, ${c}px) rotate(0deg) scale(${n})` },
    { transformOrigin: "50% 50%", transform: `translate(0px, 0px) rotate(${s}deg) scale(1)` }
  ];
}
function ki(e, t, i, s, o = {}) {
  const r = rr(e, t, i, s);
  return o.out && r.reverse(), e.animate(
    o.out ? [{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1 }],
    { duration: U, fill: o.out ? "forwards" : "none" }
  ), e.animate(r, { duration: U, easing: X(), fill: o.out ? "forwards" : "none" });
}
function ar(e, t, i, s) {
  const o = "left" in e ? e.left : e.x, r = "top" in e ? e.top : e.y, a = "width" in e ? e.width : e.w, n = "height" in e ? e.height : e.h, h = t.left + t.width / 2, c = t.top + t.height / 2;
  return { x: i / 2 + (r - c), y: s / 2 - (o + a - h), w: n, h: a };
}
function Dt(e, t, i = Lt, s = 0) {
  return e.animate([{ opacity: t ? 0 : 1 }, { opacity: t ? 1 : 0 }], {
    duration: i,
    delay: s,
    easing: t ? "cubic-bezier(0.22, 1, 0.36, 1)" : "ease-in",
    fill: t ? "backwards" : "forwards"
  });
}
function nr(e) {
  if (De || !e || e.readyState < 2 || !e.videoWidth) return null;
  const t = document.createElement("canvas"), i = Math.min(1, 960 / e.videoWidth);
  t.width = Math.round(e.videoWidth * i), t.height = Math.round(e.videoHeight * i);
  try {
    t.getContext("2d")?.drawImage(e, 0, 0, t.width, t.height);
  } catch {
    return null;
  }
  return t;
}
var hr = Object.defineProperty, lr = Object.getOwnPropertyDescriptor, F = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? lr(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && hr(t, i, o), o;
};
const Si = 1200;
let C = class extends Z {
  constructor() {
    super(...arguments), this.bands = [], this.thumbVersion = 0, this.headerText = "Events", this.thumbSize = 0, this.timeSize = 12, this.playingKey = "", this.lastPlayedKey = "", this.keepLastPlayed = !1, this.expanded = !1, this.gridColumns = 2, this.accent = "#fc9df3", this.hideHead = !1, this.gridThumbWidth = 120, this.dateFontSize = 13, this.itemTextSize = 12, this.captions = !1, this.gridCaptions = !1, this.loaded = !0, this.fsPalette = !1, this._imgReady = /* @__PURE__ */ new Set(), this._askedAt = /* @__PURE__ */ new Map(), this._ioRoot = null, this._requested = /* @__PURE__ */ new Set(), this._bandByKey = /* @__PURE__ */ new Map(), this._toggle = () => {
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
    this._ioRoot = this._stripEl ?? null, this._io = new IntersectionObserver((e) => this._onIntersect(e), {
      root: this._ioRoot,
      rootMargin: "300px 300px"
    }), this._observeThumbs();
  }
  updated() {
    this._io && (this._stripEl ?? null) !== this._ioRoot && (this._io.disconnect(), this._setupObserver()), this._observeThumbs();
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._io?.disconnect(), this._io = void 0, clearTimeout(this._lateTimer);
  }
  /** Ask for a thumbnail (once): it loads, and the item shows when it is in. */
  _request(e) {
    if (this._requested.has(e)) return;
    this._requested.add(e), this._askedAt.set(e, performance.now());
    const t = this._bandByKey.get(e);
    t && this.loader?.get(t), clearTimeout(this._lateTimer), this._lateTimer = setTimeout(() => this.requestUpdate(), Si + 20);
  }
  /** Is an item's picture in (or has it waited long enough to show without)? */
  _shown(e) {
    if (this._imgReady.has(e)) return !0;
    const t = this._askedAt.get(e);
    return t !== void 0 && performance.now() - t >= Si;
  }
  _onImg(e) {
    this._imgReady.has(e) || (this._imgReady.add(e), this.requestUpdate());
  }
  /** Before the grid opens: ask for its first `n` pictures now, so they are
   *  loading - and mostly in - by the time it shows. */
  preload(e) {
    for (const t of this.bands.slice(0, e)) {
      const i = `${t.type}@${t.start}`;
      this._bandByKey.set(i, t), this._request(i);
    }
  }
  /** Resolves once every item in view has its picture in and decoded (or
   *  `maxMs` passed): the page shows the grid then, rather than a grid of
   *  pictures arriving. An item still waiting fades in on its own later. */
  async firstScreenReady(e) {
    const t = performance.now() + e, i = (r) => new Promise((a) => setTimeout(a, r));
    let s = [];
    for (; await this.updateComplete, s = Array.from(this.renderRoot.querySelectorAll(".clip")).filter((a) => {
      const n = a.getBoundingClientRect();
      return n.bottom > 0 && n.top < window.innerHeight;
    }), !(!s.some((a) => {
      const n = a.querySelector(".thumb")?.dataset.key;
      return !!n && !this._imgReady.has(n);
    }) || performance.now() >= t); )
      await i(40);
    this.toggleAttribute("instant", !0), this.requestUpdate(), await this.updateComplete;
    const o = s.flatMap((r) => Array.from(r.querySelectorAll("img")));
    await Promise.race([Promise.all(o.map((r) => r.decode().catch(() => {
    }))), i(150)]), this.getBoundingClientRect(), this.toggleAttribute("instant", !1);
  }
  /** A thumb scrolled into view -> request its thumbnail (once). */
  _onIntersect(e) {
    let t = !1;
    for (const i of e) {
      if (!i.isIntersecting) continue;
      const s = i.target.dataset.key;
      !s || this._requested.has(s) || (this._request(s), this._io?.unobserve(i.target), t = !0);
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
    return xt(e, {
      hour: "numeric",
      minute: "2-digit"
    });
  }
  /* Day-divider helpers — same formats as the timeline view's events list. */
  _fmtDay(e) {
    return xt(e, {
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
    return xt(e, {
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
  /** One clip's thumbnail, when it is on screen (a zoom transition flies to
   *  and from it). */
  thumbOf(e) {
    if (!e) return null;
    const t = this.renderRoot.querySelector(`.thumb[data-key="${CSS.escape(e)}"]`), i = this.renderRoot.querySelector(".gridlist") ?? this.renderRoot.querySelector(".strip");
    return t && cs(t, i) ? t : null;
  }
  /** One event item — identical in both presentations (the expanded grid only
   *  changes the layout around it, never the item itself). */
  _renderClip(e, t, i) {
    const s = this.playingKey === t || (this.expanded || this.keepLastPlayed) && this.lastPlayedKey === t, o = this.gridCaptions || this._shown(t);
    return u`
      <button
        class="clip ${s ? "playing" : ""} ${o ? "shown" : ""}"
        @click=${() => this._select(e)}
      >
        <div class="thumb" data-key=${t}>
          ${i ? u`<img
                src=${i}
                alt=${e.label}
                @load=${() => this._onImg(t)}
                @error=${() => this._onImg(t)}
              />` : u`<span class="ph"></span>`}
          <!-- Caption mode moves the time to the line below (with the
               duration); the compact mode overlays it on the footage. -->
          ${this.captions ? b : u`<span class="time">${this._fmtTime(e.start)}</span>`}
        </div>
        <span class="cam">${e.cameraName}</span>
        ${this.captions ? u`<span class="sub"
              >${this._fmtTimeLong(e.start)} ·
              ${e.ongoing ? "In progress" : this._fmtDur(e.durMs ?? e.end - e.start)}</span
            >` : b}
      </button>
    `;
  }
  render() {
    this._bandByKey.clear();
    const t = `--upc-strip-thumb:${this.thumbSize > 0 ? `${this.thumbSize}px` : "calc((100% - 12px) / 2)"};--upc-strip-time:${this.timeSize}px;--upc-egrid-item:${this.itemTextSize}px;--upc-egrid-sub:${Math.max(1, this.itemTextSize - 1)}px`;
    if (!this.loaded && !this.expanded) {
      const s = u`<button class="clip hold" tabindex="-1" aria-hidden="true">
        <div class="thumb"></div>
        <span class="cam">&nbsp;</span>
        ${this.captions ? u`<span class="sub">&nbsp;</span>` : b}
      </button>`;
      return u`<div class="strip" style=${t}>${s}${s}</div>`;
    }
    const i = Oe(
      this.bands,
      (s) => `${s.type}@${s.start}`,
      (s, o) => {
        const r = `${s.type}@${s.start}`;
        this._bandByKey.set(r, s);
        const a = this._requested.has(r) ? this.loader?.get(s) : void 0, n = this.expanded && (o === 0 || !this._sameDay(this.bands[o - 1].start, s.start));
        return u`
          ${n ? u`<div class="day-divider">
                <span class="day-label">${this._fmtDay(s.start)}</span>
              </div>` : b}
          ${this._renderClip(s, r, a)}
        `;
      }
    );
    return u`
      ${this.hideHead ? b : u`<div class="head">
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
      ${this.bands.length === 0 ? u`<div class="empty">No events</div>` : this.expanded ? u`<div
              class="gridlist"
              style="--upc-egrid-cols:${this.gridColumns};--upc-egrid-w:${this.gridThumbWidth}px;--upc-egrid-date:${this.dateFontSize}px;--upc-egrid-item:${this.itemTextSize}px;--upc-egrid-sub:${Math.max(1, this.itemTextSize - 1)}px;--upc-strip-time:${this.timeSize}px;--upc-strip-divider:${this.accent}"
            >
              ${i}
            </div>` : u`<div class="strip" style=${t}>${i}</div>`}
      ${b}
    `;
  }
};
C.styles = ft`
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
    /* Phone (not the tablet's grid): an item waits invisible until its picture
       has loaded, then fades in whole - no black boxes, no pictures popping
       into them (see _shown). Its playing frame comes and goes softly too. */
    :host(:not([gridcaptions])) .clip {
      opacity: 0;
      transition:
        opacity 0.35s ease-out,
        background-color 0.25s ease-out,
        padding 0.25s ease-out;
    }
    :host(:not([gridcaptions])) .clip.shown {
      opacity: 1;
    }
    :host([instant]) .clip {
      transition: none;
    }
    :host(:not([gridcaptions])) .clip .thumb {
      transition: border-radius 0.25s ease-out;
    }
    :host(:not([gridcaptions])) .clip .cam,
    :host(:not([gridcaptions])) .clip .sub {
      transition: color 0.25s ease-out;
    }
    /* Before the events are in (see loaded): the carousel's place, held by
       items that never show - nothing below it moves when they arrive. */
    .clip.hold {
      visibility: hidden;
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
       stretching to fill (which ignored width changes). The columns are
       CENTRED in the pane (packed left, the width they don't fill was a dead
       strip down the right; the day dividers span the columns, so they centre
       with them). */
    :host([gridcaptions]) .gridlist {
      grid-template-columns: repeat(auto-fill, var(--upc-egrid-w, 132px));
      justify-content: center;
      gap: 14px 20px;
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
    /* The camera screen's panel (fs): the same card in the overlay's colours,
       and room under the last item. */
    :host([fs][captions]) .clip.playing {
      background: var(--upc-accent-deep, var(--upc-accent, #6a4266));
    }
    :host([fs][captions]) .clip.playing .cam {
      color: #fff;
    }
    :host([fs][captions]) .clip.playing .sub {
      color: rgba(255, 255, 255, 0.8);
    }
    :host([fs]) .gridlist {
      /* (Room the host's panel can set: what its edges' fades cover, or the
         gap kept at the top of a list that scrolls on to the screen's edge.) */
      padding-top: var(--upc-fs-list-pad-top, 0px);
      padding-bottom: var(--upc-fs-list-pad-bottom, 16px);
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
  p({ attribute: !1 })
], C.prototype, "bands", 2);
F([
  p({ attribute: !1 })
], C.prototype, "loader", 2);
F([
  p({ type: Number })
], C.prototype, "thumbVersion", 2);
F([
  p()
], C.prototype, "headerText", 2);
F([
  p({ type: Number })
], C.prototype, "thumbSize", 2);
F([
  p({ type: Number })
], C.prototype, "timeSize", 2);
F([
  p()
], C.prototype, "playingKey", 2);
F([
  p()
], C.prototype, "lastPlayedKey", 2);
F([
  p({ type: Boolean })
], C.prototype, "keepLastPlayed", 2);
F([
  p({ type: Boolean, reflect: !0 })
], C.prototype, "expanded", 2);
F([
  p({ type: Number })
], C.prototype, "gridColumns", 2);
F([
  p()
], C.prototype, "accent", 2);
F([
  p({ type: Boolean })
], C.prototype, "hideHead", 2);
F([
  p({ type: Number })
], C.prototype, "gridThumbWidth", 2);
F([
  p({ type: Number })
], C.prototype, "dateFontSize", 2);
F([
  p({ type: Number })
], C.prototype, "itemTextSize", 2);
F([
  p({ type: Boolean, reflect: !0 })
], C.prototype, "captions", 2);
F([
  p({ type: Boolean, reflect: !0 })
], C.prototype, "gridCaptions", 2);
F([
  p({ type: Boolean })
], C.prototype, "loaded", 2);
F([
  p({ type: Boolean, reflect: !0, attribute: "fs" })
], C.prototype, "fsPalette", 2);
F([
  tt(".strip")
], C.prototype, "_stripEl", 2);
C = F([
  mt("upc-event-strip")
], C);
var cr = Object.defineProperty, dr = Object.getOwnPropertyDescriptor, I = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? dr(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && cr(t, i, o), o;
};
let R = class extends Z {
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
  // PERF-SCRUB-2026-08-03: memoised formatters — one per rendered row before.
  // Revert: inline `new Intl.DateTimeFormat(undefined, {...}).format(new Date(t))`.
  _fmtTime(e) {
    return xt(e, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
  _fmtDay(e) {
    return xt(e, {
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
  /** One event's thumbnail, when it is on screen in this list (a zoom
   *  transition flies to and from it). */
  thumbOf(e) {
    if (!e) return null;
    const t = this.renderRoot.querySelector(`.thumb[data-key="${CSS.escape(e)}"]`);
    return t && cs(t, this._listEl) ? t : null;
  }
  scrollToDay(e) {
    const t = e + 864e5, i = [...this.bands].sort((n, h) => h.start - n.start).find((n) => n.start < t);
    if (!i || !this._listEl) return;
    const o = this.renderRoot.querySelector(`.thumb[data-key="${i.type}@${i.start}"]`)?.closest(".row");
    if (!o) return;
    const r = o.previousElementSibling, a = r?.classList.contains("day-divider") ? r : o;
    this._listEl.scrollTop = a.offsetTop;
  }
  render() {
    const e = [...this.bands].sort((i, s) => s.start - i.start), t = `--list-size:${this.textSize}px;--list-dur-size:${this.durationSize}px;--list-active-size:${this.activeTextSize}px;--list-active-dur-size:${this.activeDurationSize}px;--list-active-color:${this.activeTextColor};--list-active-dur-color:${this.activeDurationColor};--list-active-bg:${this.activeBg};--list-thumb-w:${this.thumbWidth}px;` + (this.dividerColor ? `--upc-divider:${this.dividerColor};` : "") + (this.textColor ? `--list-color:${this.textColor};` : "") + (this.durationColor ? `--list-dur-color:${this.durationColor};--list-dur-op:1;` : "");
    return this._bandByKey.clear(), u`
      <div class="list" style=${t}>
        ${e.length === 0 ? u`<div class="empty">No events in this range</div>` : Oe(
      e,
      (i) => `${i.type}@${i.start}`,
      (i, s) => {
        const o = `${i.type}@${i.start}`;
        this._bandByKey.set(o, i);
        const r = this._requested.has(o) ? this.loader?.get(i) : void 0, a = this.playingKey === o, n = i.ongoing ? "In progress" : this._fmtDur(i.durMs ?? i.end - i.start), h = this.showCamera && !!i.cameraName, c = h ? i.cameraName : this._fmtTime(i.start), d = h ? `${this._fmtTime(i.start)} · ${n}` : n, l = s === 0 || !this._sameDay(e[s - 1].start, i.start);
        return u`
                  ${l ? u`<div class="day-divider">
                        <span
                          class="day-label"
                          style="font-size:${this.dateFontSize}px;color:${this.dateFontColor || "#fff"}"
                          >${this._fmtDay(i.start)}</span
                        >
                      </div>` : b}
                  <button class="row ${a ? "playing" : ""}" @click=${() => this._play(i)}>
                    <div class="info">
                      <div class="t1">${c}</div>
                      <div class="t2">${d}</div>
                    </div>
                    <div class="thumb" data-key=${o}>
                      ${r ? u`<img src=${r} alt=${i.label} />` : u`<span class="ph"></span>`}
                    </div>
                  </button>
                `;
      }
    )}
      </div>
    `;
  }
};
R.styles = ft`
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
      transition: background-color 0.2s ease-out; /* the playing highlight moves softly */
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
      transition: color 0.2s ease-out;
    }
    .t2 {
      font-size: var(--list-dur-size, 12px);
      /* Defaults to the time color (inherited), dimmed; full color if set. */
      color: var(--list-dur-color, currentColor);
      opacity: var(--list-dur-op, 0.7);
      white-space: nowrap;
      transition:
        color 0.2s ease-out,
        opacity 0.2s ease-out;
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
I([
  p({ attribute: !1 })
], R.prototype, "bands", 2);
I([
  p({ attribute: !1 })
], R.prototype, "loader", 2);
I([
  p({ type: Number })
], R.prototype, "thumbVersion", 2);
I([
  p({ type: Number })
], R.prototype, "textSize", 2);
I([
  p()
], R.prototype, "textColor", 2);
I([
  p({ type: Number })
], R.prototype, "durationSize", 2);
I([
  p()
], R.prototype, "durationColor", 2);
I([
  p({ type: Number })
], R.prototype, "activeTextSize", 2);
I([
  p()
], R.prototype, "activeTextColor", 2);
I([
  p({ type: Number })
], R.prototype, "activeDurationSize", 2);
I([
  p()
], R.prototype, "activeDurationColor", 2);
I([
  p()
], R.prototype, "activeBg", 2);
I([
  p()
], R.prototype, "playingKey", 2);
I([
  p({ type: Number })
], R.prototype, "dateFontSize", 2);
I([
  p()
], R.prototype, "dateFontColor", 2);
I([
  p()
], R.prototype, "dividerColor", 2);
I([
  p({ type: Number })
], R.prototype, "thumbWidth", 2);
I([
  p({ type: Boolean, reflect: !0 })
], R.prototype, "showCamera", 2);
I([
  p({ type: Boolean, reflect: !0 })
], R.prototype, "line1White", 2);
I([
  tt(".list")
], R.prototype, "_listEl", 2);
R = I([
  mt("upc-events-list")
], R);
function Jt(e) {
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
function Se(e) {
  if (!e) return;
  e instanceof HTMLVideoElement && Jt(e);
  const t = (i) => {
    for (const s of Array.from(i.querySelectorAll("*")))
      s instanceof HTMLVideoElement && Jt(s), s.shadowRoot && t(s.shadowRoot);
  };
  t(e), "shadowRoot" in e && e.shadowRoot && t(e.shadowRoot);
}
var pr = Object.defineProperty, ur = Object.getOwnPropertyDescriptor, J = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? ur(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && pr(t, i, o), o;
};
const ce = 800, _r = 4e3, vt = /* @__PURE__ */ new Set(), fr = 200;
function ps(e, t) {
  for (const i of Array.from(e.querySelectorAll("*")))
    if (i instanceof HTMLVideoElement && i.readyState >= 2 && i.videoWidth > 0 || i instanceof HTMLVideoElement && i.poster && t?.has(i.poster) || i instanceof HTMLImageElement && i.complete && i.naturalWidth > 0 || i.shadowRoot && ps(i.shadowRoot, t)) return !0;
  return !1;
}
let K = class extends Z {
  constructor() {
    super(...arguments), this.entries = [], this.stacked = !1, this.newest = {}, this.minuteTick = 0, this.columns = 2, this.scrollMode = !1, this.aspect = "16/9", this._streamReady = !1, this._visible = !1, this._streamSince = /* @__PURE__ */ new WeakMap(), this._watchFrames = () => {
      clearTimeout(this._frameTimer), this._frameTimer = void 0;
      const e = performance.now();
      let t = !1;
      for (const i of Array.from(this.renderRoot.querySelectorAll("ha-camera-stream:not(.live)"))) {
        let s = this._streamSince.get(i);
        s === void 0 && (s = e, this._streamSince.set(i, s), i.closest(".tile")?.classList.remove("ready"));
        const o = this.stacked ? vt : void 0;
        i.shadowRoot && ps(i.shadowRoot, o) || e - s > _r ? (i.classList.add("live"), i.closest(".tile")?.classList.add("ready")) : t = !0;
      }
      for (const i of Array.from(this.renderRoot.querySelectorAll(".tile:not(.ready)")))
        i.querySelector(".connecting") && i.classList.add("ready");
      t && this.isConnected && (this._frameTimer = setTimeout(this._watchFrames, 100));
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
    this._visibilityObserver = new IntersectionObserver((e) => {
      const t = e[e.length - 1].isIntersecting;
      t !== this._visible && (t || Se(this.renderRoot), this._visible = t);
    }), this._visibilityObserver.observe(this);
    try {
      this._posterObserver = new PerformanceObserver((e) => {
        let t = !1;
        for (const i of e.getEntries())
          !i.name.includes("/api/camera_proxy/") || vt.has(i.name) || (vt.add(i.name), vt.size > fr && vt.delete(vt.values().next().value), t = !0);
        t && this._watchFrames();
      }), this._posterObserver.observe({ type: "resource", buffered: !0 });
    } catch {
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback(), clearTimeout(this._frameTimer), this._frameTimer = void 0, this._visibilityObserver?.disconnect(), this._visibilityObserver = void 0, this._posterObserver?.disconnect(), this._posterObserver = void 0, Se(this.renderRoot);
  }
  updated() {
    this._watchFrames();
  }
  /** One camera's tile (a zoom transition flies to and from it - from the
   *  part of it inside this grid's viewport, see coverPart). */
  tileOf(e) {
    return this.renderRoot.querySelector(`.tile[data-camera="${CSS.escape(e)}"]`);
  }
  _open(e) {
    this.dispatchEvent(
      new CustomEvent("tile-open", { detail: e, bubbles: !0, composed: !0 })
    );
  }
  _renderTile(e) {
    const t = e.live_camera || e.camera, i = this.hass?.states[t], s = e.name || this.hass?.states[e.camera]?.attributes?.friendly_name || e.camera.split(".")[1] || e.camera, o = this.newest[e.camera];
    return u`
      <div class="tile" role="button" data-camera=${e.camera} @click=${() => this._open(e)}>
        ${this._visible && this._streamReady && i ? u`<ha-camera-stream
              .hass=${this.hass}
              .stateObj=${i}
              .controls=${!1}
              .muted=${!0}
              .fitMode=${"cover"}
              allow-exoplayer
            ></ha-camera-stream>` : i ? b : u`<div class="connecting">${t} not found</div>`}
        <span class="name">${s}</span>
        ${o ? u`<span class="last">${o.label}: ${Zo(o.start, Date.now())}</span>` : ""}
      </div>
    `;
  }
  render() {
    const e = this.stacked ? 1 : this.columns || Math.max(1, this.entries.length), t = [];
    for (let i = 0; i < this.entries.length; i += e)
      t.push(this.entries.slice(i, i + e));
    return u`
      <div class="grid" style="--upc-grid-aspect:${this.aspect}">
        ${t.map((i) => u`<div class="row">${i.map((s) => this._renderTile(s))}</div>`)}
      </div>
    `;
  }
};
K.styles = ft`
    :host {
      display: block;
      height: 100%;
      overflow: hidden; /* wide: the tiles fill the box — nothing to scroll */
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
      display: flex;
      flex-direction: column;
      gap: 0; /* flush tiles — no spacing, like the UniFi app */
    }
    :host([stacked]) .grid,
    :host([scrollmode]) .grid {
      height: auto; /* content-sized — scrolls instead of filling */
    }
    .row {
      display: flex;
      flex: 1 1 0; /* wide: the rows share the box's height */
      min-height: 0;
      gap: 0;
    }
    :host([stacked]) .row,
    :host([scrollmode]) .row {
      flex: 0 0 auto;
    }
    .tile {
      position: relative;
      flex: 1 1 0; /* wide: the tiles share their row (an orphan spans it) */
      min-width: 0;
      border-radius: 0; /* flush, like the UniFi app */
      overflow: hidden;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    :host([stacked]) .tile,
    :host([scrollmode]) .tile {
      aspect-ratio: var(--upc-grid-aspect, 16/9);
    }
    :host([stacked]) .tile {
      border-radius: 10px; /* phone: full-width cards read better rounded */
      background: #000;
      /* The whole tile - its black card, picture and labels - waits invisible
         until its stream has a picture, then fades in as one (see
         _watchFrames): black cards and names popping up first read as a
         flash. */
      opacity: 0;
      transition: opacity ${ce}ms ease;
    }
    :host([stacked]) .tile.ready {
      opacity: 1;
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
      /* Shown once it has a picture, slowly (see _watchFrames). */
      opacity: 0;
      transition: opacity ${ce}ms ease;
    }
    ha-camera-stream.live,
    :host([stacked]) ha-camera-stream {
      opacity: 1; /* (the phone fades the whole tile instead) */
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
      /* ...with the picture it is for. */
      opacity: 0;
      transition: opacity ${ce}ms ease;
    }
    .tile:has(ha-camera-stream.live)::after {
      opacity: 1;
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
  `;
J([
  p({ attribute: !1 })
], K.prototype, "hass", 2);
J([
  p({ attribute: !1 })
], K.prototype, "entries", 2);
J([
  p({ type: Boolean, reflect: !0 })
], K.prototype, "stacked", 2);
J([
  p({ attribute: !1 })
], K.prototype, "newest", 2);
J([
  p({ type: Number })
], K.prototype, "minuteTick", 2);
J([
  p({ type: Number })
], K.prototype, "columns", 2);
J([
  p({ type: Boolean, reflect: !0, attribute: "scrollmode" })
], K.prototype, "scrollMode", 2);
J([
  p()
], K.prototype, "aspect", 2);
J([
  m()
], K.prototype, "_streamReady", 2);
J([
  m()
], K.prototype, "_visible", 2);
K = J([
  mt("upc-live-grid")
], K);
function mr(e, t, i, s) {
  return i || t === "muted" ? !1 : e === "auto" || t === "unmuted";
}
const $i = 6e4, vr = 1e4, gr = 5e3, br = 5e3, wr = 8e3, yr = 15e3, xr = 400, kr = 15, Sr = 25 * 6e4, $r = 2 * 6e4, Tr = 5 * 6e4, Er = 16, Ar = 6, Cr = 2;
function Mr(e, t, i) {
  return e ? [i ? "fast" : void 0, t ? "fine" : void 0].filter(
    (s) => !!s
  ) : [t ? "fine" : void 0, i ? "fast" : void 0].filter(
    (s) => !!s
  );
}
class Pr {
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
    const s = i ? this._fastSprites : this._sprites, o = i ? ".fast-sprite.json" : ".sprite.json";
    try {
      const r = await fetch(t.url.replace(/\.mp4$/, o)), a = r.ok ? await r.json() : void 0;
      let n = null;
      return a?.version === 1 && a.count && a.cols && a.rows && a.tile_w && a.tile_h && Array.isArray(a.sheets) && a.sheets.length && (n = {
        count: a.count,
        cols: a.cols,
        rows: a.rows,
        tileW: a.tile_w,
        tileH: a.tile_h,
        sheets: a.sheets
      }), s.set(t.key, n), n ?? void 0;
    } catch {
      s.set(t.key, null);
      return;
    }
  }
  /** Tile index within the unit for `t`. `count - 1` is the last REAL frame:
   *  the trailing tiles of the final sheet are ffmpeg's padding and must never
   *  be shown. */
  tileIndexFor(t, i, s) {
    const o = t.end - t.start;
    if (o <= 0) return 0;
    const r = Math.min(1, Math.max(0, (s - t.start) / o));
    return Math.min(i.count - 1, Math.floor(r * i.count));
  }
  /** Which sheet a tile index lives in, and where inside it. */
  tileAt(t, i) {
    const s = t.cols * t.rows, o = Math.min(t.count - 1, Math.max(0, i)), r = t.sheets[Math.floor(o / s)];
    if (!r) return;
    const a = o % s;
    return { sheet: r, sx: a % t.cols * t.tileW, sy: Math.floor(a / t.cols) * t.tileH };
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
    let o = this._sheetLoading.get(t);
    if (!o) {
      if (i && this._sheetInflight >= Cr) return;
      o = this._fetchSheet(t).finally(() => this._sheetLoading.delete(t)), this._sheetLoading.set(t, o);
    }
    return o;
  }
  async _fetchSheet(t) {
    const i = new AbortController();
    this._sheetAborts.set(t, i), this._sheetInflight++;
    try {
      const s = await fetch(`${this._dir}/${t}`, { signal: i.signal });
      if (!s.ok) return;
      const o = await createImageBitmap(await s.blob());
      for (this._sheets.set(t, o); this._sheets.size > Ar; ) {
        const r = this._sheets.keys().next().value;
        if (r === void 0 || r === t) break;
        const a = this._sheets.get(r);
        this._sheets.delete(r), a?.close();
      }
      return o;
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
    if (i < $i) {
      const s = this._head;
      s && t !== void 0 && t >= s.start && i >= vr && this._refreshIndex();
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
      const s = await Le(`${this._dir}/index.json`, (o) => o.generated, $r);
      if (s && Array.isArray(s.blocks)) {
        t = !0, this._blocks = new Set(s.blocks), this._mapped = new Set(s.maps ?? []), s.block_ms && s.block_ms > 0 && (this._blockMs = s.block_ms), this._overview = new Set(s.overview ?? []), this._spriteBlocks = new Set(s.sprites ?? []), this._spriteOverview = new Set(s.osprites ?? []), this._fastSpriteBlocks = new Set(s.fast_sprites ?? []), this._fastSpriteOverview = new Set(s.fast_osprites ?? []), s.overview_block_ms && s.overview_block_ms > 0 && (this._overviewMs = s.overview_block_ms);
        const o = s.head;
        this._head = o && typeof o.start == "number" && typeof o.end == "number" && o.end > o.start ? {
          start: o.start,
          end: o.end,
          map: !!o.map,
          file: o.file,
          fastSprite: !!o.fast_sprite
        } : void 0, this._head && !this._head.file && !this._warnedNoHeadFile && (this._warnedNoHeadFile = !0, console.warn(
          "[unifi-protect-timeline-card] scrub preview: protect_scrub.py is out of date (head has no immutable `file`) — near-live preview disabled. Update the pyscript job."
        )), i = Date.now() - (s.generated ?? 0) > Sr;
      }
    } catch {
    }
    this._indexAt = t ? Date.now() : Date.now() - Math.max(0, $i - gr), i && this._requestSync();
  }
  /** Ask protect_cache for a pass (throttled). It runs itself every 15 s, so
   *  a stale index means it is failing; the call at least records why. No-ops
   *  when protect_cache isn't installed — the card keeps a plain scrub stage. */
  _requestSync() {
    if (!this._hass) return;
    const t = Date.now();
    t - this._lastSync < Tr || (this._lastSync = t, this._hass.callWS({ type: "call_service", domain: "protect_cache", service: "scrub_sync" }).catch(() => {
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
      const o = this._headHeld;
      return o && o.start === s.start && t <= o.end && this._blobs.has(o.key) ? o : {
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
    t - this._tipReqAt < wr || this._tip && this._tip.end > t - yr || (this._tipReqAt = t, this._hass.callWS({
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
        for (let i = 0; i < kr; i++) {
          if (await new Promise((s) => setTimeout(s, xr)), !this._tipEnabled) return;
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
    !this._tipEnabled || !this._dir || Date.now() - this._tipAt < br || await this._fetchTip();
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
      for (this._blobs.set(t.key, o), t.head && !t.part && (this._headHeld = t); this._blobs.size > Er; ) {
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
const Rr = 248, zr = 249, Lr = 250, Bt = 251, de = 252, pe = 253, ue = 254, Fr = 255;
function* _e(e, t, i) {
  const s = new DataView(e.buffer, e.byteOffset, e.byteLength);
  let o = t;
  for (; o + 8 <= i; ) {
    let r = s.getUint32(o), a = 8;
    if (r === 1) {
      if (o + 16 > i) return;
      r = Number(s.getBigUint64(o + 8)), a = 16;
    } else r === 0 && (r = i - o);
    if (r < a || o + r > i) return;
    yield { type: String.fromCharCode(e[o + 4], e[o + 5], e[o + 6], e[o + 7]), start: o + a, end: o + r }, o += r;
  }
}
function Or(e, t, i = 0) {
  const s = new DataView(e.buffer, e.byteOffset, e.byteLength), o = _e(e, 0, e.length).next().value;
  if (!o || o.type !== "moof") return { keys: [], end: null };
  for (const r of _e(e, o.start, o.end)) {
    if (r.type !== "traf") continue;
    let a = 0, n = i, h = null, c = null;
    const d = [];
    for (const l of _e(e, r.start, r.end)) {
      const _ = s.getUint32(l.start) & 16777215;
      if (l.type === "tfhd") {
        let v = l.start + 8;
        _ & 1 && (v += 8), _ & 2 && (v += 4), _ & 8 && (a = s.getUint32(v), v += 4), _ & 16 && (v += 4), _ & 32 && (n = s.getUint32(v));
      } else if (l.type === "tfdt")
        h = e[l.start] === 1 ? Number(s.getBigUint64(l.start + 4)) : s.getUint32(l.start + 4);
      else if (l.type === "trun" && h != null) {
        const v = s.getUint32(l.start + 4);
        let w = l.start + 8;
        _ & 1 && (w += 4);
        let T = null;
        _ & 4 && (T = s.getUint32(w), w += 4);
        let z = h;
        for (let O = 0; O < v && w <= l.end; O++) {
          let M = a, W = O === 0 && T != null ? T : n;
          _ & 256 && (M = s.getUint32(w), w += 4), _ & 512 && (w += 4), _ & 1024 && (W = s.getUint32(w), w += 4), _ & 2048 && (w += 4), W & 65536 || d.push(z / t), z += M;
        }
        c = z / t;
      }
    }
    return { keys: d, end: c };
  }
  return { keys: [], end: null };
}
function Ir(e, t) {
  for (let i = 4; i + 16 <= e.length; i++) {
    if (e[i] !== 116 || e[i + 1] !== 102 || e[i + 2] !== 100 || e[i + 3] !== 116) continue;
    const s = e[i + 4], o = new DataView(e.buffer, e.byteOffset + i + 8);
    return (s === 1 ? Number(o.getBigUint64(0)) : o.getUint32(0)) / t;
  }
  return null;
}
function Dr(e) {
  for (let t = 4; t + 28 <= e.length; t++)
    if (!(e[t] !== 116 || e[t + 1] !== 114 || e[t + 2] !== 101 || e[t + 3] !== 120))
      return new DataView(e.buffer, e.byteOffset + t + 24).getUint32(0);
  return 0;
}
function Br(e) {
  for (let t = 4; t + 24 <= e.length; t++) {
    if (e[t] !== 109 || e[t + 1] !== 100 || e[t + 2] !== 104 || e[t + 3] !== 100) continue;
    const i = e[t + 4], s = t + 8 + (i === 1 ? 16 : 8);
    return s + 4 > e.length ? null : new DataView(e.buffer, e.byteOffset + s).getUint32(0);
  }
  return null;
}
function Ti(e) {
  let t = 0;
  for (const o of e) t += o.length;
  const i = new Uint8Array(t);
  let s = 0;
  for (const o of e)
    i.set(o, s), s += o.length;
  return i;
}
function Ur(e) {
  return e.split(",").map((t) => t.trim()).filter(Boolean).join(", ");
}
class Ei {
  constructor() {
    this._carry = null, this._codecs = "", this._timescale = 9e4, this._trexFlags = 0, this._parts = null;
  }
  reset() {
    this._carry = null, this._parts = null;
  }
  push(t) {
    let i = t;
    if (this._carry) {
      const r = new Uint8Array(this._carry.length + t.length);
      r.set(this._carry), r.set(t, this._carry.length), i = r, this._carry = null;
    }
    const s = [];
    let o = 0;
    for (; i.length - o >= 4; ) {
      const r = i[o], a = i[o + 1] << 16 | i[o + 2] << 8 | i[o + 3];
      if (i.length - o - 4 < a) break;
      const n = i.subarray(o + 4, o + 4 + a);
      o += 4 + a, this._frame(r, n, s);
    }
    return o < i.length && (this._carry = i.slice(o)), s;
  }
  _frame(t, i, s) {
    switch (t) {
      case Rr:
        this._codecs = Ur(new TextDecoder().decode(i));
        return;
      case Lr: {
        const o = i.slice();
        this._timescale = Br(o) ?? this._timescale, this._trexFlags = Dr(o), s.push({ kind: "init", codecs: this._codecs, data: o });
        return;
      }
      case zr:
        this._parts = { [Bt]: [], [ue]: [], [de]: [], [pe]: [] };
        return;
      case Bt:
      case ue:
      case de:
      case pe:
        this._parts?.[t].push(i.slice());
        return;
      case Fr: {
        const o = this._parts;
        if (this._parts = null, !o || !o[Bt].length) return;
        const r = Ti(o[Bt]), a = Or(r, this._timescale, this._trexFlags);
        s.push({
          kind: "media",
          data: Ti([r, ...o[ue], ...o[de], ...o[pe]]),
          time: Ir(r, this._timescale),
          keys: a.keys,
          end: a.end
        });
        return;
      }
      default:
        return;
    }
  }
}
const Ai = "/api/protect_stream/ws", Nr = 45 * 86400, Hr = 30, Ci = 12, Vr = 45, Wr = 90, fe = 1, qr = 0.75, jr = 4, Mi = 0.45, Gr = 0.15, Kr = 1.1, Yr = 1.25, Xr = 1, Zr = 2500, Jr = 3e3, Pi = 2, Qr = 10 * 6e4, ta = 1500, ea = 9e4, ia = 2e4, Qt = 36e3, Ri = 45, zi = 5, Li = 3, Ut = Qt + 4e3, sa = 12e3, oa = 4e3, ra = 11e3, Fi = [1e3, 3e3, 8e3], aa = 15e3, na = 4 * 1024 * 1024, ha = 0.75, Oi = 3, la = 1200, Nt = 0.2, Ii = De ? 450 : 250, Di = ["waiting", "stalled", "playing", "pause", "seeking", "seeked", "error", "emptied", "ended", "loadedmetadata", "resize"];
class ca {
  constructor(t, i = {}) {
    this._hass = t, this._hooks = i, this.base = Math.floor(Date.now() / 1e3) - Nr, this._video = null, this._nvrId = "", this._cameraId = "", this._channel = 0, this._ms = null, this._msUrl = null, this._msOpen = !1, this._mmsStreaming = !0, this._sb = null, this._codecs = "", this._ops = [], this._bfOps = [], this._initMain = null, this._liveGop = null, this._busy = !1, this._lastEvict = 0, this._quotaHold = !1, this._ws = null, this._wsOpening = null, this._gen = 0, this._stream = null, this._deframer = new Ei(), this._retryPending = !1, this._fails = 0, this._progressMark = -1 / 0, this._idleUntil = 0, this._skipFrom = null, this._live = !1, this._liveFirst = null, this._liveKey0 = null, this._liveJoined = !1, this._joinAt = 0, this._liveMovedCt = -1, this._liveMovedAt = 0, this._rejoins = 0, this._liveRestarts = 0, this._wantPlay = !1, this._bound = null, this._boundHit = !1, this._rate = 1, this._lowLatency = !1, this._liveChannel = null, this._epoch = 0, this._settled = !1, this._target = null, this._awaitSeeked = !1, this._seekedAt = 0, this._twoStep = null, this._recoveries = 0, this._notYetSteps = 0, this._bf = null, this._bfFor = null, this._viaNvr = !1, this._keys = [], this._rvfc = 0, this._destroyed = !1, this._epochAt = 0, this._snapAt = 0, this._onSbUpdateEnd = () => {
      this._busy = !1, this._extendDuration(), this._tick(), this._pump();
    }, this._onSbError = () => {
      this._busy = !1;
      const s = this._stream;
      s && this._streamFailed(s, "the browser rejected the footage (SourceBuffer error)");
    }, this._onMessage = (s) => {
      const o = this._stream;
      if (typeof s.data == "string") {
        let a;
        try {
          a = JSON.parse(s.data);
        } catch {
          return;
        }
        if (!o || a.gen !== o.gen) return;
        a.ev === "open" ? o.opened = !0 : a.ev === "end" ? (o.ended = !0, this._onStreamEnd(o)) : a.ev === "error" && this._streamFailed(o, a.message || "stream error");
        return;
      }
      const r = s.data;
      if (!(!o || r.byteLength < 4 || new DataView(r).getUint32(0) !== o.gen))
        for (const a of this._deframer.push(new Uint8Array(r, 4))) this._accept(o, a);
    }, this._tick = () => {
      const s = this._video;
      if (!s || !this._sb || this._destroyed || this._failedMsg) return;
      ot() && this._snapshot(s);
      const o = this._bf;
      if (o && !this._bfOps.length && Date.now() - (o.session + this.base) * 1e3 > Ut ? this._stopBackfill("expired") : o?.running && performance.now() - o.lastDataAt > (o.end == null ? oa : ra) && this._bfRetry(o), this._live) {
        this._liveTick(s), this._queueEvict(), this._pump();
        return;
      }
      const r = this._target;
      if (!this._settled && r != null && this._stream?.kind === "live" && !this._loadedAt(r) && !this._inLiveSession(r) && !this._bfOps.length) {
        const d = performance.now() - this._epochAt > sa, l = this._bfWillFill(r) || (this._liveFirst == null || this._bfStarting()) && this._behindLiveReach(r);
        if (!l || d) {
          this._stopBackfill(l ? "too slow" : "cannot serve"), this._log("bf:reaim", { at: this._wall(r) }), this._viaNvr = !0;
          try {
            this.seek((r + this.base) * 1e3, { play: this._wantPlay });
          } finally {
            this._viaNvr = !1;
          }
          return;
        }
      }
      !this._settled && this._target != null && this._twoStep == null && s.readyState >= 1 && !s.seeking && (s.currentTime < this._target - 0.25 || s.currentTime > this._target + Oi) ? (this._awaitSeeked = !0, s.currentTime = this._target) : !this._settled && this._target != null && this._twoStep == null && !this._awaitSeeked && !s.seeking && this._recoveries < 2 && performance.now() - this._seekedAt > la && this._recoverSeek(s);
      const a = this._settled ? s.currentTime : this._target ?? s.currentTime, n = this._rangeAt(a), h = this._stream, c = n ? n[1] - a : 0;
      if (!s.seeking) {
        const d = this._nextRangeAfter(n ? n[1] : a), l = n ? n[1] - a < 0.3 : !0, _ = h && !h.ended && (h.last == null || (n ? h.last <= n[1] + 0.5 : h.last < a)) || this._bfWillFill(n ? n[1] : a) || this._bfOps.length > 0;
        if (l && d != null && !_ && (this._settled || h?.first != null && h.first > a)) {
          this._settled || (this._target = d), this._awaitSeeked = !0, s.currentTime = d;
          return;
        }
      }
      if (h?.kind === "live" && !h.ended) {
        const d = this._liveRange(), l = d ? d[1] - a : 0;
        l > Ri && (this._log("timeshiftEnd", { behind: +l.toFixed(1) }), this._stopStream());
      } else if (h?.kind === "play" && !h.ended) {
        const d = !this._mmsStreaming && c > 2;
        !h.paused && (c > Hr || d) ? this._flow(!0) : h.paused && c < Ci && !d && this._flow(!1);
      } else if (!h && c < Ci && this._mmsStreaming && !this._retryPending) {
        let d = n ? n[1] : a;
        this._skipFrom != null && this._skipFrom > d && (d = this._skipFrom);
        const l = this._bound != null ? this._bound / 1e3 - this.base : 1 / 0, _ = (d + this.base) * 1e3;
        d < l - 0.3 && _ < Date.now() - ta && performance.now() >= this._idleUntil && this._openPlay(_);
      }
      this._queueEvict(), this._pump();
    }, this._onDbgVideoEvent = (s) => {
      const o = this._video;
      if (!o) return;
      const r = s.type === "error" && o.error ? `${o.error.code} ${o.error.message}` : void 0;
      this._log(`v:${s.type}`, { ct: this._wall(o.currentTime), rs: o.readyState, seeking: o.seeking, err: r });
    }, this._onSeeked = () => {
      const s = this._video;
      if (s && this._twoStep != null) {
        const o = this._twoStep;
        this._twoStep = null, this._awaitSeeked = !0, s.currentTime = o;
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
      const o = this._stream, r = `video error ${s.error.code}${s.error.message ? `: ${s.error.message}` : ""}`, a = this.wallTime, n = this._live;
      this._dropMedia(), o ? this._streamFailed(o, r) : this._hooks.problem?.(r), !this._failedMsg && (n ? this.live() : a != null && this.seek(a));
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
    return t === this._nvrId && i === this._cameraId && s === this._channel ? !1 : (this._nvrId = t, this._cameraId = i, this._channel = s, this._stopBackfill("camera changed"), this._bfFor = null, this._stopStream(), this._dropMedia(), this._lastWall = void 0, this._epoch++, this._settled = !1, this._target = null, !0);
  }
  /** Recorded playback stops (paused) here; nothing is fetched past it. */
  setBound(t) {
    this._bound = t && t > 0 ? t : null, this._boundHit = !1;
  }
  setRate(t) {
    this._rate = t, this._video && (this._video.playbackRate = t);
  }
  /** Play LIVE from another of the camera's channels than recordings (which
   *  exist only on channel 0); null = the same. Takes effect at the next
   *  `live()` - or, behind live, at the next seek (the live stream filling
   *  ahead restarts on it) - into the same buffer: the timeline is wall
   *  clock, so the new channel's footage lands where the old one's would, and
   *  the frame on screen stays until its first frame presents. */
  setLiveChannel(t) {
    t !== this._liveChannel && (this._liveChannel = t, this._log("liveChannel", { ch: t }));
  }
  /** Hold live as close to real time as is safe (on from Talk until the live
   *  session ends). Off restores the normal rate; the lag stays where it is. */
  setLowLatency(t) {
    this._lowLatency !== t && (this._lowLatency = t, !t && this._video && (this._video.playbackRate = this._rate));
  }
  /** Follow the live edge. */
  live() {
    this._log("live"), this._liveRestarts = 0, this._goLive();
  }
  _goLive() {
    if (!(!this._video || this._destroyed)) {
      if (this._liveStreaming() && this._stream.channel === (this._liveChannel ?? this._channel)) {
        this._log("resumeLive"), this._failedMsg = void 0, this._live = !0, this._liveJoined = !1, this._rejoins = 0, this._bound = null, this._boundHit = !1, this._wantPlay = !0, this._skipFrom = null, this._newEpoch(null), this._tick(), this._hooks.change?.();
        return;
      }
      this._failedMsg = void 0, this._live = !0, this._liveFirst = null, this._liveKey0 = null, this._liveJoined = !1, this._rejoins = 0, this._bound = null, this._boundHit = !1, this._wantPlay = !0, this._skipFrom = null, this._newEpoch(null), this._ensureMedia(), this._openStream("live", Date.now()), this._hooks.change?.();
    }
  }
  /**
   * Show the frame at `wallMs` exactly. Inside what is loaded this is a native
   * seek; outside it the NVR streams from the keyframe before `wallMs` into
   * the same buffer, and the frame on screen stays until the target presents.
   */
  seek(t, i = {}) {
    const s = this._video;
    if (!s || this._destroyed) return;
    this._failedMsg = void 0, i.play !== void 0 && (this._wantPlay = i.play);
    let o = t / 1e3 - this.base;
    this._bound != null && (o = Math.min(o, (this._bound - Ii) / 1e3 - this.base));
    const r = this._keepLiveFor(o);
    this._log("seek", { to: Math.round(t), play: i.play, timeshift: r }), this._stream?.kind === "live" && !r && this._stopStream(), this._live = !1, this._liveJoined = !1, s.playbackRate = this._rate, this._boundHit = !1, this._skipFrom = null, this._idleUntil = 0, this._newEpoch(o), this._ensureMedia();
    const a = this._stream;
    r && a?.kind === "live" && a.channel !== (this._liveChannel ?? this._channel) && (this._log("timeshiftChannel", { from: a.channel }), this._openStream("live", Date.now()));
    const n = this._rangeAt(o), h = !!n && n[1] - o >= Nt, c = this._stream;
    c && c.kind === "play" && !this._feeds(c, h ? n : null, o) && this._stopStream(), this._awaitSeeked = !0, s.currentTime = o, !h && !this._stream && (!this._viaNvr && this._behindLiveReach(o) ? (this._log("behindLive", { at: this._wall(o) }), this._openStream("live", Date.now())) : this._openPlay((o + this.base) * 1e3)), this._wantPlay ? this._play() : s.pause(), this._tick(), this._hooks.change?.();
  }
  play() {
    this._wantPlay = !0, !this._boundHit && (this._play(), this._tick());
  }
  /** Pause. Pausing LIVE leaves live: the paused frame becomes recorded
   *  footage - with the live stream still filling behind it (timeshift), so
   *  play carries on from the paused frame and live is rejoined in the same
   *  stream; it stops once the frame is TIMESHIFT_MAX_S behind. */
  pause() {
    this._log("pause", { live: this._live }), this._wantPlay = !1, this._video?.pause(), this._live && (this._live = !1, this._liveJoined = !1, this._video && (this._video.playbackRate = this._rate), this._video && (this._target = this._video.currentTime)), this._hooks.change?.();
  }
  /** Is this wall-clock instant loaded (so a seek to it is native)? */
  isLoaded(t) {
    return this._loadedAt(t / 1e3 - this.base);
  }
  /** Media time t is loaded, with a little footage after it. */
  _loadedAt(t) {
    const i = this._rangeAt(t);
    return !!i && i[1] - t >= Nt;
  }
  /** Does a seek to media time t keep the live stream running (timeshift)? In
   *  the live session's footage, in what its backfill holds or delivers (or
   *  will, once it starts), or in other footage still loaded not far behind
   *  its edge. */
  _keepLiveFor(t) {
    const i = this._stream;
    if (!i || i.kind !== "live" || i.ended) return !1;
    const s = !this._viaNvr && this._behindLiveReach(t);
    if (this._liveFirst == null) return s;
    if (this._inLiveSession(t) || !this._viaNvr && this._bfWillFill(t) || this._bfStarting() && s) return !0;
    const o = this._liveRange();
    return !!o && this._loadedAt(t) && o[1] - t <= Ri;
  }
  /** Media time t is recent enough that the NVR may refuse a playback starting
   *  there (RECORDED_SAFE_MS), but within what a backfill covers: the live
   *  stream and its backfill deliver it exactly (see BACKFILL_MS). */
  _behindLiveReach(t) {
    const i = Date.now() - (t + this.base) * 1e3;
    return i > 0 && i <= Ut - 3e3;
  }
  /** The live stream's backfill is still to start: no footage yet to place
   *  it, or not started for this session. */
  _bfStarting() {
    return !this._bf && (this._liveFirst == null || this._bfFor !== this._liveFirst);
  }
  /** Can a seek reach this instant exactly - loaded, delivered behind live
   *  (its session's stream or backfill), or recent enough to be fetched that
   *  way (a seek there starts the live stream and its backfill)? */
  isAvailable(t) {
    const i = t / 1e3 - this.base;
    return this.isLoaded(t) || this.timeshiftable(t) || this._behindLiveReach(i);
  }
  /** Is this instant playable behind live on the running live stream and its
   *  backfill - never waiting on the NVR's accept edge (timeshift)? */
  timeshiftable(t) {
    return this._keepLiveFor(t / 1e3 - this.base);
  }
  /** The live stream is running (live, or timeshifted behind it). */
  _liveStreaming() {
    const t = this._stream;
    return !!t && t.kind === "live" && !t.ended && this._liveFirst != null;
  }
  /** Media time t is in the running live session's footage (from its first
   *  keyframe on), so its stream delivers it - nothing to ask the NVR for. */
  _inLiveSession(t) {
    return this._liveStreaming() && t >= (this._liveKey0 ?? this._liveFirst) - 0.05;
  }
  /** Release the decoder and the socket (hidden card). The next live()/seek() rebuilds. */
  suspend() {
    this._log("suspend"), this._stopBackfill("suspended"), this._bfFor = null, this._stopStream(), this._closeSocket(), this._dropMedia(), this._settled = !1;
  }
  destroy() {
    this._destroyed = !0, this.suspend(), this._video && this._unbindVideo(this._video), this._video = null, clearInterval(this._tickTimer);
  }
  // ---- media source --------------------------------------------------------
  _ensureMedia() {
    const t = this._video;
    if (!t || this._ms) return;
    const s = window.ManagedMediaSource, o = new (s ?? MediaSource)();
    if (this._ms = o, this._msOpen = !1, this._mmsStreaming = !0, t.disableRemotePlayback = !0, o.addEventListener(
      "sourceopen",
      () => {
        this._ms === o && (this._msOpen = !0, this._pump());
      },
      { once: !0 }
    ), ot())
      for (const r of ["sourceopen", "sourceended", "sourceclose"])
        o.addEventListener(r, () => this._log(`ms:${r}`, { current: this._ms === o }));
    s ? (o.addEventListener("startstreaming", () => {
      this._mmsStreaming = !0, this._tick();
    }), o.addEventListener("endstreaming", () => {
      this._mmsStreaming = !1, this._tick();
    }), t.srcObject = o) : (this._msUrl = URL.createObjectURL(o), t.src = this._msUrl), t.playbackRate = this._rate;
  }
  /** Detach the MediaSource and free the decoder (a detached element keeps it). */
  _dropMedia() {
    this._stopBackfill("media dropped"), this._ops = [], this._bfOps = [], this._initMain = null, this._liveGop = null, this._busy = !1, this._sb = null, this._codecs = "", this._msOpen = !1, this._quotaHold = !1, this._ms && (this._ms = null, this._video && Jt(this._video), this._msUrl && URL.revokeObjectURL(this._msUrl), this._msUrl = null), this._liveFirst = null, this._liveKey0 = null, this._liveJoined = !1;
  }
  /** Run the next queued append/remove: a backfill append in progress first
   *  (to its end - see _planBackfillAppend; evictions may cut in, a quota
   *  error needs them), then the stream's. */
  _pump() {
    if (!(!this._ms || !this._msOpen || this._busy || this._quotaHold))
      for (this._bfOps.length || this._planBackfillAppend(); ; ) {
        const i = this._bfOps.length > 0 && this._ops[0]?.t !== "remove", s = i ? this._bfOps : this._ops;
        if (!s.length) return;
        const o = s[0];
        if (!i && o.t !== "remove" && o.gen !== this._gen) {
          s.shift();
          continue;
        }
        if (o.t === "init" && !this._prepareBuffer(o.codecs)) {
          s.shift();
          return;
        }
        const r = this._sb;
        if (!r) {
          s.shift();
          continue;
        }
        if (r.updating) return;
        try {
          if (o.t === "remove") {
            if (s.shift(), o.end > o.start) {
              this._busy = !0, r.remove(o.start, o.end);
              return;
            }
            continue;
          }
          const a = o.t === "media" && o.windowEnd || 1 / 0;
          r.appendWindowEnd !== a && (r.appendWindowEnd = a);
          let n = o.data, h = 1;
          if (o.t === "media") {
            const c = [o.data];
            let d = o.data.length;
            for (; h < s.length; ) {
              const l = s[h];
              if (l.t !== "media" || l.gen !== o.gen || l.windowEnd || o.windowEnd || d + l.data.length > na) break;
              c.push(l.data), d += l.data.length, h++;
            }
            if (h > 1) {
              n = new Uint8Array(d);
              let l = 0;
              for (const _ of c)
                n.set(_, l), l += _.length;
            }
            i || this._trackLiveGop(s.slice(0, h));
          } else i || (this._initMain = o);
          this._busy = !0, r.appendBuffer(n), s.splice(0, h);
          return;
        } catch (a) {
          if (this._busy = !1, a?.name === "QuotaExceededError") {
            this._onQuota();
            return;
          }
          if (s.shift(), i) {
            this._log("bf:appendFailed", { message: a?.message ?? String(a) });
            continue;
          }
          const n = this._stream;
          n && this._streamFailed(n, `append failed: ${a?.message ?? a}`);
          return;
        }
      }
  }
  /** Remember the live GOP being built, from its keyframe's fragment on
   *  (the backfill puts it back after its own footage). */
  _trackLiveGop(t) {
    const i = this._stream;
    if (!(!i || i.kind !== "live" || t[0]?.gen !== i.gen))
      for (const s of t)
        s.key != null ? this._liveGop = { start: s.key, ops: [s] } : this._liveGop && this._liveGop.ops.length < 600 ? this._liveGop.ops.push(s) : this._liveGop = null;
  }
  /**
   * Put the backfill's delivered footage into the buffer - only while the
   * playhead (or the seek heading for it) is behind the live GOP being built,
   * since that GOP has to go back in after it: MSE takes one stream at a
   * time, and live fragments appended after the backfill would lose their
   * video until the next live keyframe (see BACKFILL_MS). So: remove the
   * current live GOP, append the backfill (its fragments are whole GOPs,
   * each from a keyframe), then the GOP again from its keyframe - and live
   * carries on seamlessly from there. While live plays, it waits; and only
   * what the playhead needs goes in (from its GOP on - ~4 MB a GOP).
   */
  _planBackfillAppend() {
    const t = this._bf, i = this._video, s = this._liveGop, o = this._stream;
    if (!t || !t.held.length || !i || this._live || !s || !this._initMain || !o || o.kind !== "live" || o.ended || s.ops[0].gen !== o.gen) return;
    const r = this._settled ? i.currentTime : this._target ?? i.currentTime;
    if (r > s.start - 0.5 || r > t.session + 1) return;
    const a = t.held.filter((c) => c.end > r - 0.05);
    if (!a.length) return;
    const n = this._sb;
    if (t.init && t.init.codecs !== this._initMain.codecs && !n?.changeType) {
      this._stopBackfill("no changeType");
      return;
    }
    t.held = t.held.filter((c) => c.end <= r - 0.05);
    const h = [{ t: "remove", start: s.start - 5e-4, end: 1 / 0 }];
    t.init && h.push(t.init);
    for (const c of a)
      h.push({ t: "media", gen: -1, data: c.data, windowEnd: c.end > t.session ? t.session : void 0 });
    h.push(this._initMain, ...s.ops), this._log("bf:append", {
      from: this._wall(a[0].time),
      to: this._wall(a[a.length - 1].end),
      gops: a.length,
      live: s.ops.length
    }), this._bfOps = h;
  }
  /** Create the SourceBuffer on the first init, or switch codecs. */
  _prepareBuffer(t) {
    const i = this._ms;
    if (!i) return !1;
    const s = `video/mp4; codecs="${t}"`;
    if (this._sb) {
      if (t === this._codecs) return !0;
      const r = this._sb;
      if (r.changeType && !r.updating)
        try {
          return r.changeType(s), this._codecs = t, !0;
        } catch {
        }
      const a = this._stream;
      return a && this._streamFailed(a, `codec changed to ${t}`), !1;
    }
    const o = i.constructor;
    if (o.isTypeSupported && !o.isTypeSupported(s))
      return this._giveUp(`This device cannot play this camera's video (${t}).`), !1;
    try {
      const r = i.addSourceBuffer(s);
      return r.mode = "segments", r.timestampOffset = -this.base, r.addEventListener("updateend", this._onSbUpdateEnd), r.addEventListener("error", this._onSbError), this._sb = r, this._codecs = t, this._extendDuration(), !0;
    } catch (r) {
      return this._giveUp(`Could not start the player: ${r?.message ?? r}`), !1;
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
    const o = this._video;
    o && !this._settled && this._target != null && Math.abs(o.currentTime - this._target) > 0.25 && (this._awaitSeeked = !0, o.currentTime = this._target);
  }
  /** The buffer is full: drop what is behind the playhead and try again. */
  _onQuota() {
    this._log("quota", { ranges: this._rangesWall() }), this._quotaHold = !0, this._flow(!0);
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
    const o = this._live && !this._liveJoined;
    if (o && !t) return !1;
    const r = performance.now();
    if (!t && r - this._lastEvict < 2e3) return !1;
    this._lastEvict = r;
    const a = s.currentTime, n = t ? 4 : Vr, h = this._settled ? null : this._target, c = o && this._liveFirst != null ? this._liveFirst - 0.1 : null, d = [];
    for (let l = 0; l < i.buffered.length; l++) {
      const _ = i.buffered.start(l), v = i.buffered.end(l);
      h != null && _ <= h && h <= v || c != null && v >= c || (v < a - n ? d.push([_, v]) : _ < a - n ? d.push([_, a - n]) : _ > a + Wr && d.push([_, v]));
    }
    return d.length ? (ot() && this._log("evict", {
      aggressive: t,
      ct: this._wall(a),
      removes: d.map(([l, _]) => [this._wall(l), this._wall(_)])
    }), this._ops.unshift(...d.map(([l, _]) => ({ t: "remove", start: l, end: _ }))), !0) : !1;
  }
  // ---- streams -------------------------------------------------------------
  _openPlay(t) {
    let i = t + Qr;
    this._bound != null && (i = Math.min(i, this._bound)), this._bound == null && i > Date.now() - 1e3 && (i = void 0), this._openStream("play", t, i);
  }
  _openStream(t, i, s) {
    this._stopStream(t === "live");
    const o = ++this._gen;
    this._deframer.reset();
    const r = t === "live" ? this._liveChannel ?? this._channel : this._channel, a = {
      gen: o,
      kind: t,
      channel: r,
      askedAt: performance.now(),
      from: i,
      end: s,
      opened: !1,
      paused: !1,
      ended: !1,
      first: null,
      last: null
    };
    this._log("open", { kind: t, gen: o, ch: r, from: Math.round(i), end: s && Math.round(s) }), this._stream = a, clearTimeout(this._firstDataTimer), this._firstDataTimer = window.setTimeout(() => {
      this._stream === a && a.last == null && !a.ended && this._streamFailed(a, "the NVR sent no footage");
    }, aa), this._socket().then(
      (n) => {
        if (this._stream !== a) return;
        const h = {
          op: t,
          gen: o,
          nvr_id: this._nvrId,
          camera_id: this._cameraId,
          channel: r
        };
        t === "play" && (h.start = Math.round(i), s && (h.end = Math.round(s))), n.send(JSON.stringify(h));
      },
      (n) => {
        this._stream === a && this._streamFailed(a, `relay unreachable: ${n?.message ?? n}`);
      }
    );
  }
  /** Drop the stream in flight; anything it still sends is ignored. A live
   *  stream replaced by another live stream (a channel switch - Talk - or a
   *  restart) keeps the backfill: the footage before it stays in the buffer. */
  _stopStream(t = !1) {
    const i = this._stream;
    i && (i.kind === "live" && (t || this._stopBackfill("live stopped"), this._liveGop = null), this._stream = null, this._gen++, clearTimeout(this._firstDataTimer), clearTimeout(this._retryTimer), this._retryPending = !1, !i.ended && this._ws?.readyState === WebSocket.OPEN && this._ws.send(JSON.stringify({ op: "stop" })));
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
      const s = await Yt(i, Ai, 30), o = i.auth?.data?.hassUrl || window.location.origin, r = new URL(s, o);
      r.protocol = r.protocol === "https:" ? "wss:" : "ws:";
      const a = new WebSocket(r.toString());
      return a.binaryType = "arraybuffer", await new Promise((n, h) => {
        const c = window.setTimeout(() => h(new Error("timed out")), 1e4);
        a.onopen = () => {
          clearTimeout(c), n();
        }, a.onclose = () => {
          clearTimeout(c), h(new Error("closed (is protect_cache installed and up to date?)"));
        };
      }), a.onmessage = this._onMessage, a.onclose = () => {
        if (this._ws !== a) return;
        this._ws = null;
        const n = this._stream;
        n && !n.ended && this._streamFailed(n, "connection to Home Assistant lost");
      }, this._ws = a, a;
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
  // ---- backfill: the history behind a live session (see BACKFILL_MS) -------
  /** Start the backfill for the live session that just presented its first
   *  frame - once per session. It always fetches the recordings' channel
   *  (Talk plays live from channel 1, which is not recorded; the buffer
   *  switches codec between them with changeType). */
  _startBackfill() {
    const t = this._liveFirst;
    if (this._bf || this._destroyed || t == null || this._bfFor === t || !this._liveStreaming()) return;
    this._bfFor = t;
    const i = this._blockStart(this._liveKey0 ?? t);
    if (Date.now() - (i + this.base) * 1e3 >= Ut) return;
    const s = {
      ws: null,
      running: !0,
      gen: 0,
      askedAt: performance.now(),
      lastDataAt: performance.now(),
      from: (i + this.base) * 1e3 - Ut,
      session: i,
      deframer: new Ei(),
      steps: 0,
      retries: 0,
      conn: 0,
      init: null,
      held: [],
      end: null
    };
    this._bf = s, this._log("bf:start", { from: Math.round(s.from), session: this._wall(i) }), this._bfConnect(s);
  }
  async _bfConnect(t) {
    const i = ++t.conn;
    try {
      const s = this._hass();
      if (!s) throw new Error("Home Assistant not connected");
      const o = await Yt(s, Ai, 30), r = s.auth?.data?.hassUrl || window.location.origin, a = new URL(o, r);
      a.protocol = a.protocol === "https:" ? "wss:" : "ws:";
      const n = new WebSocket(a.toString());
      if (n.binaryType = "arraybuffer", await new Promise((h, c) => {
        const d = window.setTimeout(() => c(new Error("timed out")), 1e4);
        n.onopen = () => {
          clearTimeout(d), h();
        }, n.onclose = () => {
          clearTimeout(d), c(new Error("closed"));
        };
      }), this._bf !== t || !t.running || t.conn !== i) {
        n.close();
        return;
      }
      t.ws = n, n.onmessage = (h) => this._onBfMessage(t, h), n.onclose = () => this._bfFailed(t, "connection lost"), this._bfRequest(t);
    } catch (s) {
      t.conn === i && this._bfFailed(t, `relay unreachable: ${s?.message ?? s}`);
    }
  }
  _bfRequest(t) {
    t.gen++, t.askedAt = performance.now(), t.lastDataAt = t.askedAt, t.deframer.reset(), t.ws?.send(
      JSON.stringify({
        op: "play",
        gen: t.gen,
        nvr_id: this._nvrId,
        camera_id: this._cameraId,
        channel: this._channel,
        start: Math.round(t.from)
      })
    );
  }
  /** A backfill that stopped delivering (see BACKFILL_STALL_MS) asks again
   *  from the start on a fresh socket - what it already has is skipped. */
  _bfRetry(t) {
    if (t.retries >= 2) {
      this._bfFailed(t, "stalled");
      return;
    }
    t.retries++, t.lastDataAt = performance.now(), this._log("bf:retry", { retries: t.retries, got: t.end != null });
    const i = t.ws;
    if (t.ws = null, i) {
      i.onclose = null, i.onmessage = null;
      try {
        i.readyState === WebSocket.OPEN && i.send(JSON.stringify({ op: "stop" })), i.close();
      } catch {
      }
    }
    this._bfConnect(t);
  }
  _onBfMessage(t, i) {
    if (this._bf !== t || !t.running) return;
    if (typeof i.data == "string") {
      let o;
      try {
        o = JSON.parse(i.data);
      } catch {
        return;
      }
      if (o.gen !== t.gen) return;
      if (o.ev === "open")
        this._log("bf:open", { ms: Math.round(performance.now() - t.askedAt) });
      else if (o.ev === "error") {
        if (/refused/.test(o.message ?? "") && t.steps < Li) {
          t.steps++, t.from -= zi * 1e3, this._log("bf:notyet", { steps: t.steps }), this._bfRequest(t);
          return;
        }
        this._bfFailed(t, o.message || "stream error");
      } else o.ev === "end" && this._bfFailed(t, "the NVR ended it");
      return;
    }
    const s = i.data;
    if (!(s.byteLength < 4 || new DataView(s).getUint32(0) !== t.gen)) {
      for (const o of t.deframer.push(new Uint8Array(s, 4))) {
        if (this._bf !== t || !t.running) return;
        this._acceptBf(t, o);
      }
      this._pump();
    }
  }
  _acceptBf(t, i) {
    if (i.kind === "init") {
      t.init = { t: "init", gen: -1, data: i.data, codecs: i.codecs };
      return;
    }
    if (i.time == null) return;
    const s = i.time - this.base, o = (i.end ?? i.time) - this.base;
    if (t.end == null && this._log("bf:data1", { ms: Math.round(performance.now() - t.askedAt), at: this._wall(s) }), t.lastDataAt = performance.now(), !(t.end != null && o <= t.end + 0.05)) {
      if (s < t.session - 0.02) {
        for (const r of i.keys) this._addKey(r - this.base);
        t.held.push({ data: i.data, time: s, end: o }), t.end = o;
      }
      o >= t.session - 0.02 && (this._log("bf:done", { at: this._wall(s) }), this._bfEnd(t, "met live"));
    }
  }
  /** Stop the backfill's stream; what it delivered stays (held or loaded). */
  _bfEnd(t, i) {
    if (!t.running) return;
    t.running = !1, this._log("bf:end", { why: i });
    const s = t.ws;
    if (t.ws = null, s) {
      s.onclose = null, s.onmessage = null;
      try {
        s.readyState === WebSocket.OPEN && s.send(JSON.stringify({ op: "stop" })), s.close();
      } catch {
      }
    }
  }
  /** Drop the backfill: its stream and what it holds. One going into the
   *  buffer finishes (it has the live GOP to put back). */
  _stopBackfill(t) {
    const i = this._bf;
    i && (this._bfEnd(i, t), this._bf = null, this._log("bf:stop", { why: t, held: i.held.length }));
  }
  /** The backfill can't deliver any more; a seek waiting for its footage is
   *  aimed the ordinary way on the next tick. */
  _bfFailed(t, i) {
    this._bf !== t || !t.running || (this._bfEnd(t, `failed: ${i}`), this._tick());
  }
  /** The backfill holds footage at media time t, or is yet to deliver it (or
   *  the footage just after it, which t needs to count as loaded). */
  _bfWillFill(t) {
    const i = this._bf;
    if (!i || t > i.session + 0.05) return !1;
    if (i.held.some((o) => t >= o.time - 0.05 && t < o.end)) return !0;
    const s = i.end ?? i.from / 1e3 - this.base;
    return i.running && t >= s - Nt - 0.05;
  }
  _accept(t, i) {
    if (i.kind === "init") {
      if (this._ops.push({ t: "init", gen: t.gen, data: i.data, codecs: i.codecs }), ot()) {
        const s = t.kind === "live" ? this._liveChannel ?? this._channel : this._channel;
        this._log("init", { gen: t.gen, codecs: i.codecs, ch: s });
        const o = this._hass()?.states?.[this._cameraId]?.attributes, r = Number(o?.width) || this._video?.videoWidth || 0, a = Number(o?.height) || this._video?.videoHeight || 0;
        s === 0 && go(this._cameraId, i.codecs, r, a);
      }
    } else {
      if (i.time != null) {
        const o = i.time - this.base;
        t.first == null && (t.first = o, t.kind === "live" && (this._liveFirst = o, this._liveKey0 = null), clearTimeout(this._firstDataTimer), this._log("data1", {
          gen: t.gen,
          kind: t.kind,
          ms: Math.round(performance.now() - t.askedAt),
          at: this._wall(o),
          keys: i.keys.length
        })), t.last = o;
      }
      for (const o of i.keys) this._addKey(o - this.base);
      const s = i.keys.length ? i.keys[0] - this.base : void 0;
      t.kind === "live" && this._liveKey0 == null && s != null && (this._liveKey0 = s), this._ops.push({ t: "media", gen: t.gen, data: i.data, key: s }), t.kind === "live" && !this._live && this._liveKey0 != null && this._startBackfill();
    }
    this._pump();
  }
  _onStreamEnd(t) {
    if (this._stream === t) {
      if (this._log("end", { gen: t.gen, kind: t.kind, got: t.last != null }), clearTimeout(this._firstDataTimer), t.kind === "live") {
        this._streamFailed(t, "the NVR ended the live stream");
        return;
      }
      t.last == null ? t.end && t.end < Date.now() - 6e4 ? this._skipFrom = t.end / 1e3 - this.base : this._idleUntil = performance.now() + 2e3 : t.end || (this._idleUntil = performance.now() + 3e3), this._stream = null, this._tick();
    }
  }
  _streamFailed(t, i) {
    if (this._stream !== t) return;
    if (this._log("fail", { gen: t.gen, kind: t.kind, message: i, fails: this._fails }), t.kind === "play" && /refused/.test(i) && t.from > Date.now() - ea) {
      this._notRecordedYet(t);
      return;
    }
    this._hooks.problem?.(i), this._stopStream();
    const s = this._video;
    if (s && (this._progressMark = Math.max(this._progressMark, s.currentTime)), this._fails++, this._fails > Fi.length) {
      this._giveUp("This footage could not be played. Tap an event or the timeline to try again.");
      return;
    }
    const o = Fi[this._fails - 1];
    clearTimeout(this._retryTimer), this._retryPending = !0, this._retryTimer = window.setTimeout(() => {
      this._retryPending = !1, !(this._destroyed || this._stream) && (this._live ? this._openStream("live", Date.now()) : this._tick());
    }, o), this._hooks.change?.();
  }
  /**
   * The NVR refuses a playback that starts after its recording edge - footage
   * reaches its disk ~13-20 s after it happens (measured: a request ending
   * "10 s ago" was granted up to 19.4 s ago), and live has no history. Not a
   * failure. A pending seek whose target is NOT loaded (this was its own
   * request) is asked again further back (NOTYET_STEP_S, up to
   * NOTYET_MAX_STEPS), and only then lands on the nearest footage after it.
   * A seek whose target IS loaded is left alone - the refusal was for the
   * footage after it. Both used to land on the nearest footage AFTER the
   * target: the start of the live buffer after a rewind from live, a second
   * or two back, which read as "skip back did nothing" (measured 2026-10-26:
   * 3.0, 1.5, 2.6 and 0 s for a 10 s skip). Playback that caught up with the
   * edge waits for it to move on.
   */
  _notRecordedYet(t) {
    this._log("notyet", { gen: t.gen, steps: this._notYetSteps }), this._stopStream(), this._idleUntil = performance.now() + 2e3;
    const i = this._video, s = this._target;
    if (!i || this._settled || s == null || this._loadedAt(s)) {
      this._hooks.change?.();
      return;
    }
    if (this._notYetSteps < Li) {
      this._notYetSteps++;
      const r = s - zi;
      this._target = r, this._awaitSeeked = !0, i.currentTime = r, this._idleUntil = 0, this._openPlay((r + this.base) * 1e3), this._hooks.change?.();
      return;
    }
    const o = this._nextRangeAfter(s);
    o != null && (this._target = o, this._awaitSeeked = !0, i.currentTime = o), this._hooks.change?.();
  }
  _giveUp(t) {
    this._log("giveup", { message: t }), this._stopStream(), this._failedMsg = t, this._hooks.failed?.(t), this._hooks.change?.();
  }
  // ---- playback control loop -----------------------------------------------
  /** Range [start, end] (media s) containing t, or null. */
  _rangeAt(t) {
    const i = this._sb;
    if (!i) return null;
    const s = i.buffered;
    for (let o = 0; o < s.length; o++)
      if (s.start(o) - 0.05 <= t && t <= s.end(o)) return [s.start(o), s.end(o)];
    return null;
  }
  /** Does this recorded stream feed the footage around t? */
  _feeds(t, i, s) {
    const o = t.last ?? t.from / 1e3 - this.base, r = (i ? i[0] : s) - 1, a = (i ? i[1] : s) + 1;
    return o >= r && o <= a;
  }
  /** Where the buffered footage running into media time t starts, stepping
   *  back over gaps under 2 s (a live channel switch leaves ~0.2-0.7 s). */
  _blockStart(t) {
    const i = this._sb?.buffered;
    let s = t;
    if (!i) return s;
    for (let o = i.length - 1; o >= 0; o--)
      if (!(i.start(o) > s + 0.05)) {
        if (i.end(o) < s - 2) break;
        s = Math.min(s, i.start(o));
      }
    return s;
  }
  _nextRangeAfter(t) {
    const i = this._sb;
    if (!i) return null;
    const s = i.buffered;
    for (let o = 0; o < s.length; o++) if (s.start(o) > t + 0.05) return s.start(o);
    return null;
  }
  /** The buffered LIVE footage: the newest range reaching past the first live
   *  fragment, clipped to start there (null until some is buffered). Its
   *  start is decodable: MSE drops every frame before a range's keyframe. */
  _liveRange() {
    const t = this._sb?.buffered, i = this._liveFirst;
    if (!t || i == null || !t.length) return null;
    const s = t.length - 1;
    return t.end(s) < i + 0.05 ? null : [Math.max(t.start(s), i - 0.05), t.end(s)];
  }
  /** Where to land in [start, end] for a lag of `behind`: the newest keyframe
   *  at or before it (decodes at once, even on a slow tablet), else the start. */
  _liveTarget(t, i, s) {
    const o = this._keyBefore(i - s, t);
    return o != null && o >= t ? o : t;
  }
  _liveTick(t) {
    const i = this._liveRange();
    if (!i) return;
    const [s, o] = i, r = performance.now();
    if (!this._liveJoined) {
      if (o - s < 0.3) return;
      this._join(t, this._liveTarget(s, o, this._lowLatency ? Mi : fe), r);
      return;
    }
    if (!this._settled) {
      r - this._joinAt > Zr && (t.seeking || !t.paused) && this._rejoin(t, s, o, "live did not start", r);
      return;
    }
    if (t.paused) return;
    if (Math.abs(t.currentTime - this._liveMovedCt) > 0.01)
      this._liveMovedCt = t.currentTime, this._liveMovedAt = r, this._rejoins = 0, this._liveRestarts = 0;
    else if (r - this._liveMovedAt > Jr && o > t.currentTime + 0.5) {
      this._rejoin(t, s, o, "live stalled", r);
      return;
    }
    if (t.seeking) return;
    const a = this._lowLatency ? Mi : fe, n = this._rangeAt(t.currentTime);
    if (n && n[1] < s - 0.01 && n[1] - t.currentTime < 0.3) {
      this._jump(t, this._liveTarget(s, o, a));
      return;
    }
    const h = o - t.currentTime;
    if (h > (this._lowLatency ? Xr : jr) && this._jump(t, this._liveTarget(s, o, a)))
      return;
    const c = this._lowLatency ? Gr : qr;
    let d = t.playbackRate;
    h > a + c ? d = h > a + 2 ? Yr : Kr : h <= a && (d = this._rate), d !== t.playbackRate && (t.playbackRate = d, this._log("rate", { rate: d, lag: +h.toFixed(2) }));
  }
  _join(t, i, s) {
    const o = this._sb?.buffered;
    this._log("join", {
      target: this._wall(i),
      from: this._wall(t.currentTime),
      liveFirst: this._liveFirst != null ? this._wall(this._liveFirst) : null,
      edge: o && o.length ? this._wall(o.end(o.length - 1)) : null,
      rejoin: this._liveJoined
    }), this._liveJoined = !0, this._awaitSeeked = !0, this._joinAt = s, this._liveMovedCt = i, this._liveMovedAt = s, t.currentTime = i, this._wantPlay && this._play();
  }
  /** Catch up inside the live footage - only forward, only to a keyframe the
   *  element can show at once (a mid-GOP target made a slow decoder chew
   *  through up to 5 s of frames, showing a spinner). */
  _jump(t, i) {
    return i <= t.currentTime + 0.3 ? !1 : (this._log("jump", { from: this._wall(t.currentTime), to: this._wall(i) }), t.currentTime = i, !0);
  }
  _rejoin(t, i, s, o, r) {
    if (this._rejoins++, this._log("rejoin", { why: o, n: this._rejoins, restarts: this._liveRestarts, seeking: t.seeking, rs: t.readyState }), this._rejoins > Pi) {
      if (++this._liveRestarts > Pi) {
        this._giveUp("Live video could not be played. Tap LIVE to try again.");
        return;
      }
      this._hooks.problem?.(`${o}: restarting live`), this._stopStream(), this._dropMedia(), this._goLive();
      return;
    }
    this._hooks.problem?.(`${o}: re-joining live`), this._join(t, this._liveTarget(i, s, fe), r);
  }
  // ---- telemetry (debug: true) -----------------------------------------------
  _log(t, i = {}) {
    ot() && P(t, { cam: this._cameraId, ...i });
  }
  /** Media time -> wall-clock seconds (2 decimals), for telemetry. */
  _wall(t) {
    return Math.round((t + this.base) * 100) / 100;
  }
  _rangesWall() {
    const t = this._sb?.buffered, i = [];
    if (!t) return i;
    for (let s = 0; s < t.length; s++) i.push([this._wall(t.start(s)), this._wall(t.end(s))]);
    return i.slice(-4);
  }
  _snapshot(t) {
    const i = performance.now();
    if (i - this._snapAt < 2e3) return;
    this._snapAt = i;
    const s = t.getVideoPlaybackQuality?.(), o = this._sb?.buffered, r = o && o.length ? o.end(o.length - 1) : null;
    this._log("snap", {
      live: this._live,
      joined: this._liveJoined,
      settled: this._settled,
      ct: this._wall(t.currentTime),
      lag: this._live ? +(Date.now() / 1e3 - (t.currentTime + this.base)).toFixed(2) : void 0,
      buf: r != null ? +(r - t.currentTime).toFixed(2) : null,
      ranges: this._rangesWall(),
      rate: t.playbackRate,
      paused: t.paused,
      seeking: t.seeking,
      rs: t.readyState,
      muted: t.muted,
      dropped: s?.droppedVideoFrames,
      frames: s?.totalVideoFrames,
      size: `${t.videoWidth}x${t.videoHeight}`,
      ws: this._ws?.readyState,
      stream: this._stream ? `${this._stream.kind}#${this._stream.gen}` : null,
      fails: this._fails,
      failed: this._failedMsg
    });
  }
  _newEpoch(t) {
    this._epoch++, this._epochAt = performance.now(), this._settled = !1, this._target = t, this._twoStep = null, this._recoveries = 0, this._notYetSteps = 0;
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
      const o = this._keys[s];
      if (o <= t + 1e-3) return o >= i - 0.05 ? o : null;
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
    if (!s || s[1] - i < Nt) return;
    this._recoveries++;
    const o = this._keyBefore(i, s[0]);
    this._awaitSeeked = !0, o != null && i - o > 0.05 ? (this._twoStep = i, t.currentTime = o) : t.currentTime = i;
  }
  _play() {
    const t = this._video;
    t && (this._hooks.play ? this._hooks.play(t) : t.play().catch(() => {
    }));
  }
  // ---- the <video> ---------------------------------------------------------
  _bindVideo(t) {
    if (t.addEventListener("seeked", this._onSeeked), t.addEventListener("timeupdate", this._onTimeUpdate), t.addEventListener("waiting", this._onMediaEvent), t.addEventListener("playing", this._onMediaEvent), t.addEventListener("pause", this._onMediaEvent), t.addEventListener("error", this._onVideoError), ot())
      for (const i of Di) t.addEventListener(i, this._onDbgVideoEvent);
    this._armFrameCallback(t), clearInterval(this._tickTimer), this._tickTimer = window.setInterval(this._tick, 250);
  }
  _unbindVideo(t) {
    t.removeEventListener("seeked", this._onSeeked), t.removeEventListener("timeupdate", this._onTimeUpdate), t.removeEventListener("waiting", this._onMediaEvent), t.removeEventListener("playing", this._onMediaEvent), t.removeEventListener("pause", this._onMediaEvent), t.removeEventListener("error", this._onVideoError);
    for (const s of Di) t.removeEventListener(s, this._onDbgVideoEvent);
    const i = t;
    this._rvfc && i.cancelVideoFrameCallback && i.cancelVideoFrameCallback(this._rvfc), this._rvfc = 0;
  }
  _armFrameCallback(t) {
    const i = t;
    if (!i.requestVideoFrameCallback) return;
    const s = (o, r) => {
      this._video === t && (this._presented(r.mediaTime), this._rvfc = i.requestVideoFrameCallback(s));
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
      if (this._awaitSeeked || !(this._live ? this._liveFirst != null && t >= this._liveFirst - 0.05 : this._target != null && t >= this._target - ha && t <= this._target + Oi)) return;
      this._settled = !0, this._log("settled", { live: this._live, ms: Math.round(performance.now() - this._epochAt), at: this._wall(t) }), this._hooks.change?.(), this._live && this._startBackfill();
    }
    const s = (t + this.base) * 1e3;
    if (this._lastWall = s, t > this._progressMark + 1 && (this._fails = 0, this._progressMark = t), !this._live && this._bound != null && !this._boundHit && !i.paused && s >= this._bound - Ii * Math.max(1, i.playbackRate)) {
      this._boundHit = !0, this._wantPlay = !1, i.pause(), this._hooks.frame?.(s), this._hooks.boundReached?.(), this._hooks.change?.();
      return;
    }
    this._hooks.frame?.(s);
  }
}
var da = Object.defineProperty, pa = Object.getOwnPropertyDescriptor, g = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? pa(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && da(t, i, o), o;
};
const Bi = 5 * 6e4, ua = 4e3, Ui = 1, _a = 400, fa = 1200, me = 400, ma = 40, va = 5, ga = 15, ba = 5e3, wa = 15e3, gt = 1e4, ya = "M12.5,3C17.15,3 21.08,6.03 22.47,10.22L20.1,11C19.05,7.81 16.04,5.5 12.5,5.5C10.54,5.5 8.77,6.22 7.38,7.38L10,10H3V3L5.6,5.6C7.45,4 9.85,3 12.5,3Z", xa = "M11.5,3C14.15,3 16.55,4 18.4,5.6L21,3V10H14L16.62,7.38C15.23,6.22 13.46,5.5 11.5,5.5C7.96,5.5 4.95,7.81 3.9,11L1.53,10.22C2.92,6.03 6.85,3 11.5,3Z", ka = "M10,12V22H8V14H6V12H10M18,14V20C18,21.11 17.11,22 16,22H14A2,2 0 0,1 12,20V14A2,2 0 0,1 14,12H16C17.11,12 18,12.9 18,14M14,14V20H16V14H14Z", Ni = 128, us = 247, Sa = 0.9, _s = 0.8, $a = _s, Ta = 90, Ea = 350, Aa = 3e3, Ca = 5 * 6e4, Hi = Qt + 5e3, Ma = 2e3, Pa = 250;
function Vi(e) {
  return e?.name === "NotAllowedError";
}
let f = class extends Z {
  constructor() {
    super(...arguments), this.nvrId = "", this.cameraId = "", this.gaps = [], this.targetTime = Date.now(), this.scrubbing = !1, this.live = !1, this.canTalk = !1, this.now = Date.now(), this.previewDir = "", this.previewMode = "sprites", this.fastPreview = "speed", this.tipEnabled = !1, this.clipEndTime = 0, this.accent = "", this.liveAudioStart = "muted", this.stacked = !1, this.startFs = !1, this.fsHandoff = !1, this.fsTimeline = !1, this.fsTimelineWidth = 165, this.fsTimelineGrabWidth = 0, this.fsTimelinePadding = 100, this.fsTimelineGutter = 140, this.fsTimelineScrim = 0.88, this.fsTimelineScrimExtend = 170, this.cardFs = !1, this.cardFsExit = !1, this.cardFsClose = !1, this.roundCtrl = !1, this.closable = !1, this.phone = !1, this.upright = !1, this.chromeHidden = !1, this.chromeAside = !1, this._uprightBarH = 0, this._posterOn = !1, this._posterGone = !1, this._posterFadeIn = !1, this.fsSide = 0, this.holdCtrl = !1, this._tlReach = 0, this._onTimelineReach = (e) => {
      this._tlReach = e.detail.px;
    }, this._hostW = 0, this._leftInset = 0, this._hostH = 0, this._player = new ca(() => this.hass, {
      frame: (e) => this._onFrame(e),
      change: () => this._onPlayerChange(),
      boundReached: () => this._finishEvent(),
      failed: (e) => {
        P("ui:error", { cam: this.cameraId, message: e }), this._error = e;
      },
      problem: (e) => this._reportPlaybackProblem(e),
      play: (e) => this._playFollowVideo(e)
    }), this._mode = null, this._waiting = !1, this._waitingSince = 0, this._blank = !1, this._liveSettled = !1, this._liveEpoch = 0, this._followPaused = !1, this._followMuted = !0, this._tapToPlay = !1, this._followCtrl = !1, this._ctrlMode = "live", this._isFs = !1, this._forceRotate = !1, this._talk = "idle", this._talkMsg = "", this._talkMsgOn = !1, this._modalOn = !1, this._followRate = 1, this._nearLive = !1, this._livePausedState = !1, this._liveMuted = !0, this._livePreviewWarmed = !1, this._liveAudioAttempted = !1, this._liveAudioTrying = !1, this._eventEndSent = !1, this._stageRestarts = [], this._lastTimeReport = 0, this._preview = new Pr(), this._previewActive = null, this._previewBlocks = {
      a: void 0,
      b: void 0
    }, this._previewPending = {
      a: void 0,
      b: void 0
    }, this._previewRetries = { a: 0, b: 0 }, this._previewToken = 0, this._coarseScrub = !1, this._scrubDir = 1, this._spriteReady = !1, this._spriteToken = 0, this._autoSprites = !1, this._seekSamples = [], this._reattached = !1, this._resumePaused = !1, this._resumeOnShow = !1, this._stageStuckSince = 0, this._stageLastCt = -1, this._hidden = !1, this._suspended = !1, this._hiddenAt = 0, this._hostIntersecting = !0, this._onDocVisibility = () => {
      this._onHostVisibility(this._hostIntersecting && !document.hidden);
    }, this._onTapToPlay = (e) => {
      e.stopPropagation(), this._tapToPlay = !1, this._mode === "live" ? (this._livePausedState = !1, this._reportLivePlaying(!0)) : this._followPaused = !1;
      const t = this._mainVideo;
      t && this._playFollowVideo(t);
    }, this._frozen = !1, this._showFollowCtrl = () => {
      this._followCtrl = !0, clearTimeout(this._followCtrlTimer), !(this.scrubbing || this._seekDragAt !== void 0 || this.holdCtrl) && (this._followCtrlTimer = setTimeout(() => {
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
    }, this._toggleTalk = (e) => {
      if (e.stopPropagation(), this._showFollowCtrl(), this._talk !== "idle") {
        this._stopTalk();
        return;
      }
      this._liveMuted && this._setSessionMuted(!1);
      const t = new So(this.hass, this.nvrId, this.cameraId, (i) => {
        this._talker === t && (this._talker = void 0, this._talk = "idle", i && this._showTalkMsg(i));
      });
      this._talker = t, this._talk = "connecting", this._player.setLowLatency(!0), this._player.setLiveChannel(Ui), this._player.live(), t.start().then(
        () => {
          this._talker === t && (this._talk = "talking");
        },
        (i) => {
          this._talker === t && (this._talker = void 0, this._talk = "idle", this._player.setLowLatency(!1), this._showTalkMsg(i.message || "Talking failed"));
        }
      );
    }, this._toggleFollowMute = (e) => {
      e.stopPropagation(), this._setSessionMuted(!this._followMuted), this._showFollowCtrl();
    }, this._toggleFs = (e) => {
      if (e.stopPropagation(), P("ui:fullscreen", { cam: this.cameraId, on: !this._isFs }), this.fsHandoff && !this._isFs && !document.fullscreenElement) {
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
        this._isFs = t, this._forceRotate = t && this._rotateForFs(), this._showFollowCtrl();
        return;
      }
      document.fullscreenElement ? document.exitFullscreen?.().catch(() => {
      }) : this.requestFullscreen?.().catch(() => {
      }), this._showFollowCtrl();
    }, this._onDlgClose = () => {
      this._modalOn = !1, this._isFs && (this._isFs = !1, this._forceRotate = !1);
    }, this._pressFlash = (e) => {
      const t = e.currentTarget;
      if (t.disabled) return;
      t.classList.add("pressed");
      const i = performance.now(), s = () => {
        for (const r of ["pointerup", "pointercancel", "pointerleave"])
          t.removeEventListener(r, s);
        const o = Math.max(0, Ta - (performance.now() - i));
        setTimeout(() => t.classList.remove("pressed"), o);
      };
      for (const o of ["pointerup", "pointercancel", "pointerleave"])
        t.addEventListener(o, s);
    }, this._spinArc = (e) => {
      const i = e.currentTarget.querySelector(".arc");
      if (!i) return;
      const s = i.classList.contains("fwd") ? 40 : -40;
      i.animate(
        [
          { transform: "rotate(0deg)", easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
          { transform: `rotate(${s}deg)`, offset: 0.3, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
          { transform: "rotate(0deg)" }
        ],
        { duration: 560 }
      );
    }, this._exitCardFs = (e) => {
      e.stopPropagation(), this.dispatchEvent(new CustomEvent("fs-exit", { bubbles: !0, composed: !0 }));
    }, this._close = (e) => {
      e.stopPropagation(), this.dispatchEvent(new CustomEvent("player-close", { bubbles: !0, composed: !0 }));
    }, this._onFsChange = () => {
      this.stacked || (this._isFs = !!document.fullscreenElement);
    }, this._liveSkipBack = (e) => {
      e.stopPropagation();
      const t = this._player.wallTime ?? Date.now();
      this.dispatchEvent(
        new CustomEvent("rewind", {
          detail: { time: t - gt },
          bubbles: !0,
          composed: !0
        })
      ), this._showFollowCtrl();
    }, this._toggleLivePlay = (e) => {
      e.stopPropagation(), this._livePausedState ? this._startLive() : (this._player.pause(), this._reportLivePlaying(!1)), this._showFollowCtrl();
    }, this._toggleLiveMute = (e) => {
      e.stopPropagation(), this._setSessionMuted(!this._liveMuted), this._showFollowCtrl();
    }, this._skipBack = (e) => {
      e.stopPropagation(), this._followSkip(-gt);
    }, this._skipFwd = (e) => {
      e.stopPropagation();
      const t = this._player.wallTime;
      if (t == null) return;
      const i = t + gt, s = this._player.timeshiftable(i) || i <= Date.now() - Qt;
      if (i >= Date.now() - Ma || !s) {
        this.dispatchEvent(new CustomEvent("go-live", { bubbles: !0, composed: !0 }));
        return;
      }
      this._followSkip(gt);
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
      const i = (a) => {
        this._seekDragAt = this._eventSeekAt(a, t);
      }, s = (a) => {
        t.removeEventListener("pointermove", i), t.removeEventListener("pointerup", o), t.removeEventListener("pointercancel", r);
        const n = this._seekDragAt;
        this._seekDragAt = void 0, a && n !== void 0 && this._seekFollowTo(n), this._showFollowCtrl();
      }, o = () => s(!0), r = () => s(!1);
      t.addEventListener("pointermove", i), t.addEventListener("pointerup", o), t.addEventListener("pointercancel", r), this._showFollowCtrl();
    }, this._onStripPress = (e) => {
      if (e.stopPropagation(), this._keepCtrlAlive(), e.composedPath()[0] !== e.currentTarget) return;
      this.querySelector('[slot="fs-timeline"]')?.beginDrag?.(e);
    };
  }
  connectedCallback() {
    super.connectedCallback(), document.addEventListener("fullscreenchange", this._onFsChange), this.addEventListener("timeline-reach", this._onTimelineReach), this._hostRo = new ResizeObserver((e) => {
      const t = e[e.length - 1].contentRect, i = Math.round(t.width), s = Math.round(t.height);
      i && i !== this._hostW && (this._hostW = i), s && s !== this._hostH && (this._hostH = s), this._syncLeftInset();
    }), this._hostRo.observe(this), this.addEventListener("pointerdown", this._keepCtrlAlive, !0), this.addEventListener("pointermove", this._keepCtrlAlive, !0), this.addEventListener("pointerdown", this._onPressCapture, !0), this.addEventListener("pointerup", this._onReleaseCapture, !0), this.addEventListener("pointercancel", this._onCancelCapture, !0), this.addEventListener("click", this._onClickCapture, !0), this._visObserver = new IntersectionObserver(
      (e) => {
        this._hostIntersecting = e[e.length - 1].isIntersecting, this._onDocVisibility();
      },
      { threshold: 0 }
    ), this._visObserver.observe(this), document.addEventListener("visibilitychange", this._onDocVisibility), this._stageWatch = setInterval(() => this._checkStage(), 1e3), this.hasUpdated && (this._reattached = !0, this.requestUpdate());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), clearInterval(this._stageWatch), this._stopTalk(), this._ctrlRO?.disconnect(), this._ctrlRO = void 0, this._ctrlObserved = void 0, this._mode === "recorded" && (this._resumeAt = this._player.wallTime ?? this._resumeAt, this._resumePaused = this._followPaused), this._loadedForTime = void 0, this._resetAudioSession(), clearTimeout(this._followCtrlTimer), clearTimeout(this._scrubFineTimer), clearTimeout(this._livePreviewWarmTimer), this._releaseFrame(), document.removeEventListener("fullscreenchange", this._onFsChange), this.removeEventListener("timeline-reach", this._onTimelineReach), this._hostRo?.disconnect(), this.removeEventListener("pointerdown", this._keepCtrlAlive, !0), this.removeEventListener("pointermove", this._keepCtrlAlive, !0), this.removeEventListener("pointerdown", this._onPressCapture, !0), this.removeEventListener("pointerup", this._onReleaseCapture, !0), this.removeEventListener("pointercancel", this._onCancelCapture, !0), this.removeEventListener("click", this._onClickCapture, !0), clearTimeout(this._pendingTap?.timer), this._pendingTap = void 0, this._visObserver?.disconnect(), this._visObserver = void 0, document.removeEventListener("visibilitychange", this._onDocVisibility), clearTimeout(this._suspendTimer), this._suspended = !1, this._player.suspend(), this._resetPreviewSlots(), this._preview.destroy(), Se(this.renderRoot);
  }
  willUpdate(e) {
    if (this.clipEndTime > 0 && (e.has("targetTime") || e.has("cameraId")) || e.has("cameraId") ? this._releaseFrame() : e.has("scrubbing") && !this.scrubbing && this._holdFrame(!0), e.has("cameraId") && (this._loadedForTime = void 0), e.has("poster") && (clearTimeout(this._posterTimer), this._posterOn = !!this.poster, this._posterGone = !1, this._posterFadeIn = !!this.poster && this._mode !== null), (e.has("live") && !this.live || e.has("cameraId") || e.has("canTalk") && !this.canTalk) && this._stopTalk(), e.has("scrubbing") && !this.scrubbing)
      for (const i of [this._previewVidA, this._previewVidB]) i && Jt(i);
  }
  _onHostVisibility(e) {
    e !== !this._hidden && (this._hidden = !e, clearTimeout(this._suspendTimer), this._hidden ? (this._hiddenAt = Date.now(), this._resumeOnShow = !this.live && !this.scrubbing && this._mode === "recorded" && !this._followPaused, this._resetAudioSession(), this._muteAndPauseAll(), this._suspendTimer = setTimeout(() => this._suspend(), Aa)) : this._suspended ? (!this.live && Date.now() - this._hiddenAt > Ca && this.dispatchEvent(new CustomEvent("go-live", { bubbles: !0, composed: !0 })), this._unsuspend()) : this._resumeAfterVisible());
  }
  /** Hidden for a while (a closed popup, a view HA keeps cached behind another,
   *  the screen off): let go of EVERYTHING, exactly as a detach would. Pausing
   *  is not enough — a paused player keeps its decoder, and a live stream keeps
   *  coming. A hidden card on the wall tablet once held its decoders for hours
   *  and still had them when the viewer opened live fullscreen on top of it. */
  _suspend() {
    !this._hidden || this._suspended || (P("ui:suspend", { cam: this.cameraId, mode: this._mode }), this._stopTalk(), this._mode === "recorded" && (this._resumeAt = this._player.wallTime ?? this._resumeAt ?? this.targetTime, this._resumePaused = this._followPaused, this._loadedForTime = void 0), this._player.suspend(), this._resetPreviewSlots(), this._suspended = !0);
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
    if (P("ui:resume", { cam: this.cameraId, live: this.live }), this.live) {
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
    const o = s - this._stageStuckSince;
    if (o < 2500) return;
    if (o < 6e3) {
      e.paused && this._playFollowVideo(e);
      return;
    }
    const r = this._player.wallTime ?? this.targetTime;
    if (this._stageStuckSince = 0, this._stageLastCt = -1, this._stageRestarts = this._stageRestarts.filter((a) => s - a < 12e4), this._stageRestarts.length >= 2) {
      this._reportPlaybackProblem(`playback stalled ${Math.round(o / 1e3)}s — giving up`), e.pause(), this._error = "Playback keeps stalling on this device. Tap an event or the timeline to try again.";
      return;
    }
    this._stageRestarts.push(s), this._reportPlaybackProblem(`playback stalled ${Math.round(o / 1e3)}s — restarting`), this._player.seek(r, { play: !0 });
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
    if (this._blank && (this._blank = !1, this._posterOn || this._mainVideo?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Lt, easing: "ease-out" })), this._frozen && this._releaseFrame(), this._posterOn && !this._posterGone && (this._posterGone = !0, clearTimeout(this._posterTimer), this._posterTimer = setTimeout(() => this._posterOn = !1, Lt + 60)), this._mode !== "recorded" || this.scrubbing) return;
    const t = performance.now(), i = this._lastWallReported === void 0 ? void 0 : this._lastWallReported + (t - this._lastTimeReport) * (this._mainVideo?.playbackRate ?? 1);
    if (!(i === void 0 || Math.abs(e - i) > 1e3) && t - this._lastTimeReport < Pa) return;
    this._lastTimeReport = t, this._lastWallReported = e, this.dispatchEvent(
      new CustomEvent("playback-time", { detail: { time: e }, bubbles: !0, composed: !0 })
    ), this.clipEndTime > 0 && (this._followNow = e);
    const o = Date.now() - e < Hi;
    o !== this._nearLive && (this._nearLive = o), o && this._followRate !== 1 && this._setFollowRate(1);
  }
  /** Loading / settled / failed changed. */
  _onPlayerChange() {
    const e = this._player.loading;
    if (e !== this._waiting) {
      const t = performance.now();
      P("ui:waiting", { cam: this.cameraId, on: e, mode: this._mode, ms: e ? void 0 : Math.round(t - this._waitingSince) }), e && (this._waitingSince = t), this._waiting = e;
    }
    if (this._mode === "live" && this._player.settled && !this._liveSettled) {
      this._liveSettled = !0, this._scheduleLivePreviewWarm();
      const t = this._mainVideo;
      t && mr(this.liveAudioStart, this._audioUserChoice, this._liveAudioAttempted) && this._tryAutoLiveAudio(t);
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
    P("ui:live", { cam: this.cameraId, from: this._mode }), this._mode = "live", this._error = void 0, this._tapToPlay = !1, this._followNow = void 0, this._nearLive = !1, this._resetLiveSession();
    const e = this._mainVideo;
    e && (e.muted = this._liveMuted), this._player.setLowLatency(this._talk !== "idle"), this._player.setLiveChannel(this._talk !== "idle" ? Ui : null), this._player.live(), this._reportLivePlaying(!0), this._flashFollowCtrl();
  }
  /** Play recorded footage from `at` (an event's start, a tapped time, where a
   *  hidden card left off). `fresh`: a new selection, so the old picture is
   *  hidden until the new one presents. */
  _playRecorded(e, t = {}) {
    P("ui:recorded", { cam: this.cameraId, at: Math.round(e), fresh: t.fresh, play: t.play, event: !!this._eventEnd }), this._mode = "recorded", this._error = void 0, this._tapToPlay = !1, this._nearLive = !1, this._followPaused = !(t.play ?? !0), t.fresh && !this._posterOn && (this._blank = !0), this._player.setBound(this._eventEnd || null), this._player.setLiveChannel(null);
    const i = this._mainVideo;
    i && (i.muted = this._followMuted), this._player.setRate(this._followRate), this._seekRecorded(e), this._flashFollowCtrl();
  }
  /** Position recorded playback at `tIn` (clamped to the event / what exists). */
  _seekRecorded(e) {
    let t = Math.max(this._seekFloor, Math.min(e, this._seekCeiling));
    !this._player.isAvailable(t) && !this._eventEnd && (t = Math.min(t, Date.now() - Qt)), this._followNow = t, this._lastWallReported = void 0, this._player.seek(t, { play: !this._followPaused });
  }
  firstUpdated() {
    this._fsDlg && (this._fsDlg.open = !0), this.startFs && (this.stacked ? (this._forceRotate = this._rotateForFs(), this._isFs = !0) : this.requestFullscreen?.().catch(() => {
    }));
  }
  updated(e) {
    if (e.has("_isFs") && this.stacked && this._syncFsDialog(), this.stacked && !this._isFs && !this._modalOn && this._fsDlg && !this._fsDlg.open && (this._fsDlg.open = !0), e.has("_followCtrl") || e.has("_isFs") || e.has("cardFs"))
      for (const i of this.querySelectorAll('[slot="fs-timeline"]'))
        i.toggleAttribute("inert", !this._followCtrl);
    if (e.has("holdCtrl") && (this.holdCtrl || this._followCtrl) && this._showFollowCtrl(), e.has("_isFs") && e.get("_isFs") === !0 && !this._isFs && this.startFs && this.dispatchEvent(new CustomEvent("fs-exit", { bubbles: !0, composed: !0 })), e.has("scrubbing") && (clearTimeout(this._scrubFineTimer), this._scrubFineTimer = void 0, this.scrubbing || this._preview.abortSheets(), this.scrubbing ? clearTimeout(this._followCtrlTimer) : this._followCtrl && this._showFollowCtrl()), this._syncUprightCtrl(), (e.has("cardFs") || e.has("phone") || e.has("upright")) && this._syncLeftInset(), (e.has("_isFs") || e.has("_forceRotate")) && this.dispatchEvent(
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
        if (this.clipEndTime > this.targetTime + 500) {
          i === void 0 && (this._eventEndSent = !1), this._followNow = void 0;
          const o = this.stacked && this.roundCtrl && this._mode === "recorded" && !e.has("cameraId");
          this._playRecorded(i ?? this.targetTime, {
            fresh: i === void 0 && !o,
            play: !s && !(i !== void 0 && this._eventEndSent)
          });
        } else
          this._playRecorded(i ?? this.targetTime, {
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
    const s = i ? t - i.at : 0, o = i && s > 0 && s <= me ? Math.abs(e - i.t) / s : 0;
    if (i && e !== i.t && (this._scrubDir = e > i.t ? 1 : -1), this.fastPreview === "off") {
      this._coarseScrub = !1;
      return;
    }
    if (this.fastPreview === "always") {
      this._coarseScrub = !!i && e !== i.t && s > 0 && s <= me;
      return;
    }
    const r = this._preview.blockMs();
    this._coarseScrub = this._coarseScrub ? o > r / fa : o > r / _a;
  }
  _scheduleFineScrubUpgrade() {
    clearTimeout(this._scrubFineTimer), this._scrubFineTimer = void 0, !(!this._coarseScrub || !this.scrubbing) && (this._scrubFineTimer = setTimeout(() => {
      this._scrubFineTimer = void 0, this.scrubbing && this._updatePreview();
    }, me + 25));
  }
  async _resolvePlayable(e) {
    if (this._coarseScrub) {
      const o = this._preview.overviewBlockFor(e);
      if (o) {
        if (this._unitReady(o) || (this._prefetchUnit(o), this._useSprites())) return o;
        if (this._previewActive) return;
      }
    }
    const t = this._preview.tipBlockFor(e, this._preview.headEnd());
    if (t) {
      if (this._preview.isCached(t)) return t;
      this._preview.getBlock(t).then((o) => {
        o && this.scrubbing && this._updatePreview();
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
    return Mr(
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
    if (this._autoSprites || this.previewMode !== "auto" || (this._seekSamples.push(e), this._seekSamples.length < va)) return;
    this._seekSamples.length > ga && this._seekSamples.shift();
    const t = this._seekSamples.slice().sort((s, o) => s - o);
    t[Math.floor(t.length / 2)] > ma && (this._autoSprites = !0, this.requestUpdate());
  }
  /** Paint the frame for `t` from the sprite sheets. Returns false when this
   *  unit has no atlas (tip, mapped part, or a block the job hasn't reached),
   *  so the caller can fall back to the video path for it. */
  /** The footage's pixel size: the camera entity's resolution (channel 0 = the
   *  stream the player shows), else the player's own video. undefined while
   *  neither is known. */
  _footageSize() {
    const e = this.hass?.states?.[this.cameraId]?.attributes;
    let t = Number(e?.width) || 0, i = Number(e?.height) || 0;
    return t > 0 && i > 0 || (t = this._mainVideo?.videoWidth || 0, i = this._mainVideo?.videoHeight || 0), t > 0 && i > 0 ? [t, i] : void 0;
  }
  /** Backing size of the sprite canvas. The scrub job squeezes every keyframe
   *  into a fixed 640x360 tile whatever the camera's shape (a 1920x2560
   *  portrait doorbell included), so the canvas takes the FOOTAGE's aspect and
   *  the tile is drawn stretched back into it; object-fit: contain then frames
   *  the preview exactly like the <video> it stands in for. A 16:9 camera
   *  stays 640x360, as before. */
  _spriteSize(e) {
    const t = this._footageSize();
    return t ? [e.tileW, Math.max(1, Math.round(e.tileW * t[1] / t[0]))] : [e.tileW, e.tileH];
  }
  /** Upright fullscreen ends the timeline strip just above the control bar, so
   *  the bar's height is published as --upc-fs-ctrl-h on the dialog — watched,
   *  because it changes (live vs event playback, the seek row). Re-attached if
   *  a re-render replaced the bar; dropped outside upright fullscreen. */
  /** The left edge of the screen the system covers (the host's --upc-fs-left,
   *  an env() inset: turned sideways on a phone, the status bar and camera
   *  cutout) - the play controls centre in what is left of the free area.
   *  Read off .vinset: JS can't resolve env() itself. */
  _syncLeftInset() {
    const e = this.renderRoot?.querySelector(".vinset"), t = e ? e.offsetWidth : 0;
    t !== this._leftInset && (this._leftInset = t);
  }
  _syncUprightCtrl() {
    const e = this.cardFs && this.upright ? this : this.stacked && this._isFs && !this._forceRotate ? this._fsDlg : void 0, t = this.renderRoot.querySelector(".vctrl");
    if (!e || !t) {
      this._ctrlRO?.disconnect(), this._ctrlRO = void 0, this._ctrlObserved = void 0;
      return;
    }
    this._ctrlObserved !== t && (this._ctrlRO?.disconnect(), this._ctrlRO = new ResizeObserver(() => {
      const i = t.offsetHeight;
      e.style.setProperty("--upc-fs-ctrl-h", `${i}px`), e === this && (this._uprightBarH = i);
    }), this._ctrlRO.observe(t), this._ctrlObserved = t);
  }
  /** Phone fullscreen turns the player to landscape on an upright phone (turn
   *  the phone to watch) — except for footage that is itself PORTRAIT (the
   *  doorbell): rotated, it would play sideways in a small band, so it stays
   *  upright and fills the screen, with the overlay timeline down its right
   *  edge (the `upright` layout). Unknown footage size keeps the rotation. */
  _rotateForFs() {
    if (window.innerHeight <= window.innerWidth) return !1;
    const e = this._footageSize();
    return !(e && e[1] > e[0]);
  }
  async _drawSprite(e, t) {
    const i = await this._preferredSprite(e);
    if (!i) return !1;
    const { set: s } = i, o = s.cols * s.rows, r = this._spriteToken;
    let a = this._preview.tileIndexFor(e, s, t);
    const n = Math.floor(a / o), h = s.sheets[n];
    if (!h) return !0;
    let c = this._preview.hasSheet(h) ? await this._preview.getSheet(h) : void 0;
    if (c || (c = await this._preview.getSheet(h)), !c || !this.scrubbing || r !== this._spriteToken || (a = this._preview.tileIndexFor(e, s, this.targetTime), Math.floor(a / o) !== n)) return !0;
    const d = this._preview.tileAt(s, a);
    if (!d) return !0;
    const l = this._spriteCanvas;
    if (!l) return !0;
    const [_, v] = this._spriteSize(s);
    (l.width !== _ || l.height !== v) && (l.width = _, l.height = v);
    const w = l.getContext("2d");
    if (!w) return !0;
    try {
      w.drawImage(c, d.sx, d.sy, s.tileW, s.tileH, 0, 0, _, v);
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
    const { set: s } = i, o = s.cols * s.rows, r = e.end - e.start;
    if (r <= 0) return;
    const a = Math.min(1, Math.max(0, (t - e.start) / r)), n = Math.floor(Math.min(s.count - 1, Math.floor(a * s.count)) / o), h = this._scrubDir || 1;
    for (const c of this._coarseScrub ? [n, n + h] : [n, n - 1, n + 1]) {
      const d = s.sheets[c];
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
    }, this.scrubbing && this.tipEnabled && this.targetTime > Date.now() - Bi && this._preview.requestTip(), await this._preview.ensureIndex(this.targetTime), !this.scrubbing)) return;
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
    if (!this.previewDir || !this.hass || (this._preview.configure(this.hass, this.previewDir), await this._preview.ensureIndex(this.targetTime), this.tipEnabled && this.targetTime > Date.now() - Bi && (this._preview.requestTip(), this._preview.ensureTip()), !this.scrubbing)) return;
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
    if (this._previewPending[e] = void 0, this.previewMode === "auto") {
      const a = performance.now(), n = () => {
        t.removeEventListener("seeked", n), this._noteSeek(performance.now() - a);
      };
      t.addEventListener("seeked", n, { once: !0 });
    }
    t.currentTime = r;
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
    return this.clipEndTime > this.targetTime ? Math.min(this.clipEndTime, Date.now() - ia) : 0;
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
      Vi(t) && (e.muted = !0, e.play().then(() => {
        this._tapToPlay = !1, this._audioUserChoice === "unmuted" && (e.volume = 1, e.muted = !1);
      }).catch((i) => {
        Vi(i) && (P("ui:tapToPlay", { cam: this.cameraId }), this._tapToPlay = !0);
      }));
    });
  }
  _reportPlaybackProblem(e) {
    console.warn(`[unifi-timeline] ${e}`), P("problem", { cam: this.cameraId, message: e });
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
      const o = e.getImageData(0, 0, i, s).data;
      let r = 0;
      for (let a = 0; a < o.length; a += 4) r += (o[a] + o[a + 1] + o[a + 2]) / 3;
      return r / (o.length / 4) < 3;
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
    const t = De ? void 0 : this._visibleVideo(), i = this._spriteReady && this._spriteCanvas && this._spriteCanvas.width > 0 ? this._spriteCanvas : void 0, o = (e ? [i, t] : [t, i]).find((d) => !!d), r = this._freezeCanvas;
    if (!o || !r) return;
    const a = o instanceof HTMLCanvasElement, n = a ? o.width : o.videoWidth, h = a ? o.height : o.videoHeight;
    if (!n || !h) return;
    let c = !1;
    try {
      (r.width !== n || r.height !== h) && (r.width = n, r.height = h);
      const d = r.getContext("2d", { willReadFrequently: !0 });
      d?.clearRect(0, 0, r.width, r.height), d?.drawImage(o, 0, 0, r.width, r.height), c = !!d && !this._looksBlack(d, r);
    } catch {
      c = !1;
    }
    c && (this._frozen = !0, r.removeAttribute("hidden"), clearTimeout(this._freezeTimer), this._freezeTimer = setTimeout(
      () => this._releaseFrame(),
      this.live ? ba : wa
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
        "button, input, select, a, .vseek, .tap-play, .evt-wrap, .zoom-panel, .zoom-fab, .live-arrow, .tl-foot, .fs-top, .fs-side"
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
  /** End talking, if it is on (any reason: Stop, leaving live, hidden...). */
  _stopTalk() {
    const e = this._talker;
    this._talker = void 0, this._talk !== "idle" && (this._talk = "idle"), e?.stop();
  }
  _showTalkMsg(e) {
    this._talkMsg = e, this._talkMsgOn = !0, clearTimeout(this._talkMsgTimer), this._talkMsgTimer = setTimeout(() => this._talkMsgOn = !1, ua);
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
    P("ui:mute", { cam: this.cameraId, muted: e }), this._audioUserChoice = e ? "muted" : "unmuted", this._liveMuted = e, this._followMuted = e, this._liveAudioAttempted = !0;
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
      if (e.muted = !1, await e.play(), await new Promise((s) => setTimeout(s, Ea)), t !== this._liveEpoch || e !== this._mainVideo || e.paused || e.currentTime <= i + 0.01)
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
    return e != null && Date.now() - e < Hi;
  }
  _setFollowRate(e) {
    this._followRate !== e && (this._followRate = e, this._player.setRate(e));
  }
  /** The custom control bar, the same for live and recorded footage. Live greys
   *  skip-forward + speed (nothing ahead of live); recorded greys speed near
   *  the recording edge (and its skip-forward goes live there). */
  _renderCtrlBar(e, t = !1) {
    t || (this._ctrlMode = e);
    const i = e === "live", s = i ? this._livePausedState : this._followPaused, o = i ? this._liveMuted : this._followMuted, r = i ? 1 : this._followRate, a = !i && this._followRate > 1, n = i || this._nearLive, h = i ? this._liveSkipBack : this._skipBack, c = i ? this._toggleLivePlay : this._toggleFollowPlay, d = this._skipFwd, l = this._toggleFollowRate, _ = i ? this._toggleLiveMute : this._toggleFollowMute, v = !i && this._nearLive ? "Go live" : `Forward ${gt / 1e3}s`, w = `Back ${gt / 1e3}s`, T = i && this.canTalk, z = this.canTalk ? u`<div class="vtalk-msg ${this._talkMsgOn ? "show" : ""}" role="status">${this._talkMsg}</div>` : b, O = u`<button
      class="vctrl-speed ${a ? "on" : ""}"
      ?disabled=${n}
      @click=${i ? void 0 : l}
      title="Playback speed"
    >
      ${r}<span class="vx">×</span>
    </button>`, M = u`<button
      class="vmute ${o ? "" : "on"}"
      @click=${_}
      title=${o ? "Unmute" : "Mute"}
    >
      <ha-icon icon=${o ? "mdi:volume-off" : "mdi:volume-high"}></ha-icon>
    </button>`, W = this.canTalk ? u`<button
          class="vtalk ${this._talk}"
          ?disabled=${this._talk === "connecting"}
          @click=${this._toggleTalk}
          title=${this._talk === "talking" ? "Stop talking" : "Talk"}
        >
          <ha-icon icon=${this._talk === "idle" ? "mdi:microphone-off" : "mdi:microphone"}></ha-icon>
        </button>` : b, G = T ? W : b;
    if (this.cardFs || this.roundCtrl) {
      const H = `${this._followCtrl ? "show" : ""} ${t ? "inert" : ""}`, et = this._tlReach || this.fsTimelineWidth, Y = this.fsTimeline ? et + this.fsTimelineGutter : 0, B = this.cardFs ? this.phone ? Math.max(Y, this.fsSide) : Y + this.fsSide : 0, y = !this.cardFs && !i && this.clipEndTime > this.targetTime, S = this.cardFs ? this.phone ? $a : 1 : this.stacked ? _s : Sa, V = us * S, st = this._hostW - B - this._leftInset, vs = this._hostW ? (st - V - 48) / 2 : Ni * S, gs = Math.max(28 * S, Math.min(Ni * S, Math.floor(vs))), Be = this._hostW && st < V + 2 * 28 * S + 8 ? "crowded" : "", Ue = (B - this._leftInset) / 2, bs = this.upright ? 0 : Ue, ws = this.stacked && this.roundCtrl && this._hostW ? `--upc-vc-top:${this._picCentreY()}px;` : "", Ft = `--upc-fs-shift:${Ue}px;--upc-bar-shift:${bs}px;--upc-vc-gap:${gs}px;--upc-vc-row:${V}px;--vc-k:${S};${ws}`, Ne = (Q) => u`<svg class="vc-skip-icon" viewBox="0 0 24 24" aria-hidden="true">
          <g transform="translate(0 -1)">
            <path class="arc ${Q ? "fwd" : ""}" d=${Q ? xa : ya}></path>
          </g>
          <path transform="translate(0 1)" d=${ka}></path>
        </svg>`, He = u`<button
          class="vc-skip press"
          @pointerdown=${this._pressFlash}
          @click=${(Q) => {
        this._spinArc(Q), h(Q);
      }}
          title=${w}
        >
          ${Ne(!1)}
        </button>
        <button
          class="vc-play press"
          @pointerdown=${this._pressFlash}
          @click=${c}
          title=${s ? "Play" : "Pause"}
        >
          <ha-icon icon=${s ? "mdi:play" : "mdi:pause"}></ha-icon>
        </button>
        <button
          class="vc-skip press"
          ?disabled=${i}
          @pointerdown=${this._pressFlash}
          @click=${(Q) => {
        i || (this._spinArc(Q), d(Q));
      }}
          title=${v}
        >
          ${Ne(!0)}
        </button>`;
      return u`
        ${z}
        ${this.cardFs ? u`<i class="vinset" aria-hidden="true"></i>` : b}
        <div class="vshade ${H} ${y ? "seek" : ""}" style=${Ft}></div>
        ${this.upright ? b : u`<div class="vcshade ${H} ${Be}" style=${Ft}></div>`}
        ${this.upright ? b : u`<div class="vcenter ${H} ${Be}" style=${Ft}>${He}</div>`}
        <div
          class="vctrl fs card ${H} ${T ? "has-talk" : ""}"
          style=${Ft}
          @click=${(Q) => Q.stopPropagation()}
        >
          ${this.upright ? u`<div class="vc-row">${He}</div>` : b}
          ${y ? this._renderClipSeek() : b}
          ${this.cardFs ? this._renderAxisGroup(O, M, W, T) : this._renderClipGroup(O, M, G)}
        </div>
      `;
    }
    return u`
      ${z}
      <div
        class="vctrl ${this._followCtrl ? "show" : ""} ${this._fsLook ? "fs" : ""} ${this._fsStrip ? "fs-inset" : ""} ${t ? "inert" : ""} ${T ? "has-talk" : ""}"
        style="--upc-fs-tl-w:${this.fsTimelineWidth}px;--upc-fs-tl-gut:${this.fsTimelineGutter}px;--upc-fs-tl-pad:${this.fsTimelinePadding}px;--upc-fs-side:${this.fsSide}px"
        @click=${(H) => H.stopPropagation()}
      >
        <button @click=${h} title=${w}>
          <ha-icon icon="mdi:rewind-10"></ha-icon>
        </button>
        <button @click=${c} title=${s ? "Play" : "Pause"}>
          <ha-icon icon=${s ? "mdi:play" : "mdi:pause"}></ha-icon>
        </button>
        <button ?disabled=${i} @click=${i ? void 0 : d} title=${v}>
          <ha-icon icon="mdi:fast-forward-10"></ha-icon>
        </button>
        ${O}${M}${G}
        <button class="vfs" @click=${this._toggleFs} title="Fullscreen">
          <ha-icon icon=${this._isFs ? "mdi:fullscreen-exit" : "mdi:fullscreen"}></ha-icon>
        </button>
        ${!i && this.clipEndTime > this.targetTime ? this._renderEventSeekRow() : u`<div class="vctrl-spacer"></div>`}
      </div>
    `;
  }
  /** The camera screen's bottom row (cardFs): speed, sound, talk (live only)
   *  and exit (when the host has somewhere to go back to), centred as a whole
   *  on the middle row's axis whichever of them it holds - each button placed
   *  by its index (.vg-slot). Talk keeps its slot while away, half a place
   *  past sound - right where it stands in the row it leaves or joins. */
  _renderAxisGroup(e, t, i, s) {
    const o = this.cardFsExit && !this.cardFsClose, r = 2 + (s ? 1 : 0) + (o ? 1 : 0);
    return u`<div class="vctrl-group axis" style=${`--n:${r}`}>
      <span class="vg-slot" style="--i:0">${e}</span>
      <span class="vg-slot" style="--i:1">${t}</span>
      ${this.canTalk ? u`<span class="vg-slot ${s ? "" : "off"}" style=${`--i:${s ? 2 : 1.5}`}>${i}</span>` : b}
      ${o ? u`<span class="vg-slot" style=${`--i:${r - 1}`}>
            <button class="press" @pointerdown=${this._pressFlash} @click=${this._exitCardFs} title="Exit full screen">
              <ha-icon icon="mdi:fullscreen-exit"></ha-icon>
            </button>
          </span>` : b}
    </div>`;
  }
  /** A clip player's bottom row (roundCtrl): speed, sound, "View in Timeline",
   *  Close. */
  _renderClipGroup(e, t, i) {
    return u`<div class="vctrl-group">
      ${e}${t}${i}
      ${this.fsHandoff ? u`<button
            class="vc-tl press"
            @pointerdown=${this._pressFlash}
            @click=${this._toggleFs}
            title="Watch what happened before and after, on the camera's timeline"
          >
            View in Timeline
          </button>` : b}
      ${this.closable ? u`<button class="press" @pointerdown=${this._pressFlash} @click=${this._close} title="Close">
            <ha-icon icon="mdi:close"></ha-icon>
          </button>` : b}
    </div>`;
  }
  /** The phone's camera screen: its timeline steps aside while the events
   *  panel is open (user, 2026-10-28: "the list replaces the timeline") -
   *  sideways it would push the ruler into the middle of the picture, upright
   *  off the screen's left edge. */
  _tlAside() {
    return this.cardFs && this.phone && this.fsSide > 0;
  }
  /** Where the event being played is, for its seek bar: `frac` of the way,
   *  `sec` whole seconds in of `secs` (its length as the events list rounds
   *  it - "8s" - so the bar never reads 0:07 at an 8-second event's end).
   *  An event that has played to its end reads as ended: the player stops it
   *  a little short of its last frame (END_MARGIN_MS - MSE stalls at the
   *  buffered end), which showed "−0:01" left at the end (user, 2026-10-31). */
  _clipProgress() {
    const e = this.targetTime, t = Math.max(1, this.clipEndTime - e), s = this._seekDragAt === void 0 && this._eventEndSent && this._player.atBound ? e + t : this._seekDragAt ?? this._followNow ?? e, o = Math.min(t, Math.max(0, s - e)), r = Math.max(1, Math.round(t / 1e3));
    return { frac: o / t, sec: o >= t ? r : Math.min(r, Math.floor(o / 1e3)), secs: r };
  }
  /** Time readout + seek bar over the EVENT being played, start to end, in
   *  wall-clock time — the same timeline the footage is on, so a position on
   *  the bar IS an instant and seeking to it is _seekFollowTo. */
  _renderEventSeekRow() {
    const { frac: e, sec: t, secs: i } = this._clipProgress();
    return u`<div class="vseek-row">
      <span class="vtime">${this._fmtClock(t)} / ${this._fmtClock(i)}</span>
      <div class="vseek" @pointerdown=${this._onEventSeekDown}>
        <div class="vseek-track">
          <div class="vseek-fill" style="width:${e * 100}%"></div>
          <div class="vseek-knob" style="left:${e * 100}%"></div>
        </div>
      </div>
    </div>`;
  }
  /** The round controls' seek bar over the event (.vc-seek): elapsed on the
   *  left, what is left on the right - the same drag as the classic bar. */
  _renderClipSeek() {
    const { frac: e, sec: t, secs: i } = this._clipProgress();
    return u`<div class="vc-seek">
      <span class="vtime left">${this._fmtClock(t)}</span>
      <div class="vseek ${this._seekDragAt !== void 0 ? "drag" : ""}" @pointerdown=${this._onEventSeekDown}>
        <div class="vseek-track">
          <div class="vseek-fill" style="width:${e * 100}%"></div>
          <div class="vseek-knob" style="left:${e * 100}%"></div>
        </div>
      </div>
      <span class="vtime">−${this._fmtClock(i - t)}</span>
    </div>`;
  }
  _eventSeekAt(e, t) {
    const i = t.getBoundingClientRect(), s = this._forceRotate ? (e.clientY - i.top) / i.height : (e.clientX - i.left) / i.width, o = Math.min(1, Math.max(0, s));
    return this.targetTime + o * (this.clipEndTime - this.targetTime);
  }
  /** Where the picture is drawn in this element (object-fit contain), in its
   *  own coordinates: what a zoom transition flies into or out of. */
  videoBox() {
    const e = this._footageSize(), t = this.poster instanceof HTMLCanvasElement ? this.poster : void 0, i = e ? e[0] / e[1] : t ? t.width / t.height : 16 / 9, s = this.cardFs && this.upright ? this.clientHeight - this._uprightBarH : this.clientHeight, o = or({ x: 0, y: 0, w: this.clientWidth, h: s }, i);
    return this.stacked && this.roundCtrl && (o.y = 0), o;
  }
  /** The phone's clip card: the middle of its (top-aligned) picture. */
  _picCentreY() {
    const e = this._footageSize(), t = e ? e[0] / e[1] : 16 / 9, i = this._hostH || this.clientHeight;
    return Math.min(i, this._hostW / t) / 2;
  }
  /** The frame on screen as a canvas, where that is safe (see frameOf). */
  snapshot() {
    return nr(this._mainVideo);
  }
  /** The footage's pixel size, when known (see _footageSize). */
  footageSize() {
    return this._footageSize();
  }
  /** The poster, filling the box the video will fill. */
  _renderPoster(e) {
    const t = this.videoBox(), i = `poster ${this._posterGone ? "gone" : ""} ${this._posterFadeIn ? "in" : ""}`, s = `left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px`;
    return e instanceof HTMLCanvasElement ? u`<div class=${i} style=${s}>${e}</div>` : u`<img class=${i} style=${s} src=${e} alt="" />`;
  }
  /** Fullscreen, or its card-sized equivalent (cardFs): the same chrome. */
  get _fsLook() {
    return this._isFs || this.cardFs;
  }
  /** True while the host's slotted overlay timeline is on screen. */
  get _fsStrip() {
    return this._fsLook && this.fsTimeline;
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
    const e = (o) => {
      o.stopPropagation(), this._keepCtrlAlive();
    }, t = this.fsTimelineScrim, i = `linear-gradient(to left, rgba(0,0,0,${t}) 30%, rgba(0,0,0,${(t * 0.78).toFixed(3)}) 55%, rgba(0,0,0,${(t * 0.35).toFixed(3)}) 80%, transparent)`, s = this.fsTimelineGrabWidth > 0 ? `calc(${Math.max(this.fsTimelineWidth, this.fsTimelineGrabWidth)}px + ${this.fsTimelineGutter}px)` : "100%";
    return u`<div
      class="fs-tl ${this._followCtrl ? "show" : ""} ${this._tlAside() ? "aside" : ""}"
      style="--upc-fs-tl-w:${this.fsTimelineWidth}px;--upc-fs-tl-boxw:${s};--upc-fs-tl-gut:${this.fsTimelineGutter}px;--upc-fs-tl-pad:${this.fsTimelinePadding}px;--upc-fs-tl-scrim-ext:${this.fsTimelineScrimExtend}px;--upc-fs-tl-bg:${i};--upc-fs-side:${this.fsSide}px"
      @pointerdown=${this._onStripPress}
      @pointermove=${e}
      @wheel=${e}
      @pointerup=${(o) => o.stopPropagation()}
      @pointercancel=${(o) => o.stopPropagation()}
      @click=${(o) => o.stopPropagation()}
    >
      <slot name="fs-timeline"></slot>
    </div>`;
  }
  /** cardFs: the host's camera picker (top) and events panel (right), and the
   *  close X when the exit is one (`cardFsClose`). */
  _renderCardChrome() {
    if (!this.cardFs) return b;
    const e = this._followCtrl ? "show" : "";
    return u`<div class="fs-top ${e}"><slot name="fs-top"></slot></div>
      <div class="fs-side ${e}"><slot name="fs-side"></slot></div>
      ${this.cardFsExit && this.cardFsClose ? u`<button class="fs-close" @click=${this._exitCardFs} title="Close" aria-label="Close">
            <svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"></path></svg>
          </button>` : b}`;
  }
  render() {
    const e = this._stage(), t = u`<canvas class="freeze" ?hidden=${!this._frozen}></canvas>`;
    return this.stacked ? u`<dialog
      class="fs-wrap ${this._isFs ? "fs-active" : ""} ${this._isFs ? this._forceRotate ? "rotate" : "upright" : ""}"
      @close=${this._onDlgClose}
    >
      ${e}${t}${this._renderFsTimeline()}
    </dialog>` : u`${e}${t}${this._renderFsTimeline()}${this._renderCardChrome()}`;
  }
  _stage() {
    if (!this.nvrId || !this.cameraId)
      return u`<div class="stage"><div class="msg error">Missing camera / nvr_id.</div></div>`;
    const e = this.live && !this.scrubbing, t = e && !this.hass?.states[this.cameraId], i = !this.live && this._waiting && ss(this.gaps, this.targetTime), s = !this.live && !this.scrubbing && this._mode === null, o = this.stacked && this.roundCtrl && this._hostW ? `--upc-vc-top:${this._picCentreY()}px;` : "";
    return u`
      <div
        class="stage"
        style=${(this.accent ? `--upc-accent:${this.accent};` : "") + o}
        @pointermove=${this.scrubbing ? void 0 : this._onStageHover}
      >
        <video class="main ${this._blank ? "blank" : ""}" playsinline preload="auto" muted></video>
        ${this._posterOn && this.poster && this._hostW ? this._renderPoster(this.poster) : b}
        ${this.scrubbing ? u`
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
        ${this.scrubbing ? b : this._tapToPlay ? u`<button class="tap-play" @click=${this._onTapToPlay} title="Play">▶</button>` : t ? u`<div class="msg error">Camera entity not found.</div>` : this._error ? u`<div class="msg error">${this._error}</div>` : i ? u`<div class="msg">Footage unavailable — camera was offline.</div>` : s ? u`<div class="msg">Tap the timeline to play from a time.</div>` : this._waiting && this._blank && !this._posterOn ? u`<div class="overlay"><div class="spinner"></div></div>` : this._waiting ? u`<div class="overlay buffering" aria-label="Loading footage">
                            <div class="spinner"></div>
                          </div>` : b}
        ${this.scrubbing ? this._renderCtrlBar(this._ctrlMode, !0) : this._renderCtrlBar(e ? "live" : "follow")}
      </div>
    `;
  }
};
f.styles = ft`
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
    :host(:fullscreen) .vctrl,
    :host([cardfs]) .vctrl:not(.card) {
      padding: 20px 48px 40px;
    }
    /* The card-sized fullscreen: the card's own corners clip the picture. */
    :host([cardfs]) .stage {
      border-radius: 0;
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
    /* The picture a zoom transition flew in, until the video's first frame -
       then it cross-fades away (see poster). It fills the box the VIDEO will
       fill (placed in _stage), cropped: an event thumbnail is a square crop,
       never the camera's shape, and filling the video's box means the video
       arrives in exactly the shape the picture had. */
    .poster {
      position: absolute;
      object-fit: cover;
      z-index: 1;
      pointer-events: none;
      transition: opacity ${Lt}ms ease-out;
    }
    .poster.gone {
      opacity: 0;
    }
    .poster.in {
      animation: upc-poster-in ${Lt}ms ease-out;
    }
    @keyframes upc-poster-in {
      from {
        opacity: 0;
      }
    }
    div.poster > canvas {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* A zoom transition is flying this player: only the picture shows. The
       chrome's own opacity transitions bring it back afterwards. */
    :host([chromehidden]) .vctrl,
    :host([chromehidden]) .vcenter,
    :host([chromehidden]) .vshade,
    :host([chromehidden]) .vcshade,
    :host([chromehidden]) .fs-tl,
    :host([chromehidden]) .fs-top,
    :host([chromehidden]) .fs-side,
    :host([chromehidden]) .fs-close,
    :host([chromehidden]) .vtalk-msg,
    :host([chromehidden]) .overlay,
    :host([chromehidden]) .tap-play {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: none !important; /* gone at once; back with their own fade */
    }
    /* The host's modal is up (the camera screen's calendar, 2026-10-30 - it
       sat on the play controls): every control, the timeline and the panels
       fade away, untappable, and come back with their own fades after. */
    :host([chromeaside]) .vctrl,
    :host([chromeaside]) .vcenter,
    :host([chromeaside]) .vshade,
    :host([chromeaside]) .vcshade,
    :host([chromeaside]) .fs-tl,
    :host([chromeaside]) .fs-top,
    :host([chromeaside]) .fs-side,
    :host([chromeaside]) .vtalk-msg {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transition:
        opacity 0.25s ease,
        visibility 0s linear 0.25s !important;
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
      /* An open side panel (cardFs) pushes the strip left by its width. */
      transform: translateX(calc(-1 * var(--upc-fs-side, 0px)));
      transition:
        opacity 0.2s ease,
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
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
    /* The phone's, while its events panel is open (_tlAside): faded out where
       it stands, and not tappable (visibility follows the fade). */
    .fs-tl.aside {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: none;
      transition:
        opacity 0.2s ease,
        visibility 0s linear 0.2s;
    }
    /* The host's other overlay chrome (cardFs): the camera picker along the
       top, the events panel down the right — above the strip and the controls.
       The wrappers take no taps themselves (only what the host makes
       interactive inside does), and fade with the controls; visibility follows
       the fade so a hidden panel can't be tapped. */
    .fs-top,
    .fs-side {
      position: absolute;
      z-index: 8; /* .fs-top 9: the camera picker always on top, events too */
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition:
        opacity 0.2s ease,
        visibility 0s linear 0.2s;
    }
    .fs-top {
      top: 0;
      left: 0;
      right: 0;
      z-index: 9;
    }
    .fs-side {
      top: 0;
      bottom: 0;
      right: 0;
    }
    .fs-top.show,
    .fs-side.show {
      opacity: 1;
      visibility: visible;
      transition: opacity 0.2s ease;
    }
    /* cardFsClose: the close X, top-right, 24 px in - the round glass button of
       the dashboard's pop-ups. It stays while the controls fade (only a screen
       change hides it, with the rest of the chrome). */
    .fs-close {
      position: absolute;
      top: calc(24px + env(safe-area-inset-top, 0px));
      right: calc(24px + env(safe-area-inset-right, 0px));
      z-index: 10;
      width: 44px;
      height: 44px;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
      box-shadow:
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.22),
        0 4px 14px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition:
        transform 0.2s cubic-bezier(0.32, 0.72, 0, 1),
        background-color 0.2s,
        opacity 0.2s ease;
    }
    .fs-close:active {
      transform: scale(0.9);
    }
    @media (hover: hover) {
      .fs-close:hover {
        background: rgba(255, 255, 255, 0.16);
      }
    }
    .fs-close svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.6;
      stroke-linecap: round;
    }
    /* While the strip is up, keep every control clear of it: the bar's gradient
       still spans full width, only its contents move in. Both fullscreen
       flavors set their own padding SHORTHAND at a higher specificity (the
       element-fullscreen and rotated-mobile rules below), so the inset has to
       be spelled out against each of them or it is silently overridden. */
    .vctrl.fs-inset,
    :host(:fullscreen) .vctrl.fs-inset,
    :host([cardfs]) .vctrl.fs-inset,
    :host([stacked]) .fs-wrap.fs-active .vctrl.fs-inset {
      padding-right: calc(
        var(--upc-fs-tl-w, 165px) + var(--upc-fs-tl-gut, 140px) + 12px + var(--upc-fs-side, 0px)
      );
      transition:
        opacity 0.2s ease,
        padding-right 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
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
    :host([stacked]) .vctrl.fs:not(.card) {
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
    /* ---- Card-sized fullscreen (cardFs) controls, iOS / UniFi-app style ----
       Round dimmed buttons (no backdrop blur: it stutters even on a laptop,
       let alone the wall tablet), on a dimmed shade of their own. The light
       edge keeps a button's outline on dark footage, where its dim disc would
       vanish. Back / play-pause / forward in the middle; speed, sound, talk
       and exit along the bottom. Both groups are centred in the area the
       timeline leaves free and follow it when the events panel opens
       (--upc-fs-shift). Hidden = not hit-testable (visibility), like the
       panels. */
    .vcenter button,
    .vctrl.card button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 2px solid rgba(255, 255, 255, 0.3); /* 1.5px rounds to 1px on 1x screens */
      border-radius: 50%;
      font-family: inherit; /* the skip numbers and "1x": the card's type, not the UA's */
      background: rgba(0, 0, 0, 0.6);
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
      color: #fff;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      /* Speed / sound / talk fade INTO their active colours (accent, white,
         red) and back on the iOS ease-out curve — quick to start, long soft
         tail — rather than snapping. */
      transition:
        background 0.4s cubic-bezier(0.22, 1, 0.36, 1),
        color 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .vcenter button:hover,
    .vctrl.card button:hover {
      background: rgba(0, 0, 0, 0.72);
    }
    /* Press feedback for the buttons that keep their colour (skips,
       play-pause, exit; class .press, _pressFlash adds .pressed while held),
       "iPhone player" style: the button shrinks a little and its disc greys a
       touch, then springs back with a gentle overshoot; a skip's arrow also
       spins its way (_spinArc). Each state's transition is the one used to
       ENTER it: quick in on press, the softer curve out on release. (Chosen
       over a white flash - jarring - a UIKit dim and an iOS 26 lift.) */
    .vcenter button.press,
    .vctrl.card button.press {
      transition:
        background 0.35s cubic-bezier(0.22, 1, 0.36, 1),
        color 0.35s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .vcenter button.press.pressed,
    .vctrl.card button.press.pressed {
      transform: scale(0.92);
      background: rgba(72, 72, 76, 0.72);
      transition:
        background 0.08s ease-out,
        transform 0.08s ease-out;
    }
    .vc-skip-icon .arc {
      transform-box: view-box;
      transform-origin: 12.5px 12.5px; /* the arrow's circle (11.5px for forward) */
    }
    .vc-skip-icon .arc.fwd {
      transform-origin: 11.5px 12.5px;
    }
    /* Unavailable (forward / speed at the live edge): only the glyph fades —
       the dimmed disc stays, so it still reads on bright footage. */
    .vcenter button:disabled,
    .vctrl.card button:disabled {
      opacity: 1;
      color: rgba(255, 255, 255, 0.6);
      cursor: default;
    }
    .vcenter {
      position: absolute;
      left: 50%;
      top: var(--upc-vc-top, 50%);
      z-index: 6; /* above the strip, which spans the whole player */
      display: flex;
      align-items: center;
      gap: var(--upc-vc-gap, 128px); /* fitted to the free area (VC_GAP) */
      transform: translate(calc(-50% - var(--upc-fs-shift, 0px)), -50%);
      opacity: 0;
      visibility: hidden;
      pointer-events: none; /* only the buttons take taps, not the gaps */
      transition:
        opacity 0.2s ease,
        visibility 0s linear 0.2s,
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
        gap 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .vcenter.show {
      opacity: 1;
      visibility: visible;
      transition:
        opacity 0.2s ease,
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
        gap 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    /* The groups' shades — a soft dark ellipse behind the middle row, a deep
       gradient along the bottom. Own elements BELOW the strip (z 4 < 5), while
       the buttons sit above it: painted on the buttons' layer they dimmed the
       timeline's foot (date pill, live arrow, ruler). They fade with the
       controls and take no taps. */
    .vshade,
    .vcshade {
      position: absolute;
      z-index: 4;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .vshade.show,
    .vcshade.show {
      opacity: 1;
    }
    /* Sizes below scale with --vc-k: 1 on the camera screen, CLIP_CTRL_SCALE
       on the multi page's (smaller) clip players. */
    .vshade {
      left: 0;
      right: 0;
      bottom: 0;
      height: calc(170px * var(--vc-k, 1));
      background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.42) 55%, transparent);
    }
    .vcshade {
      left: 50%;
      top: var(--upc-vc-top, 50%);
      width: calc(var(--upc-vc-row, ${us}px) + 2 * var(--upc-vc-gap, 128px) + 200px * var(--vc-k, 1));
      height: calc(257px * var(--vc-k, 1)); /* the play button + 80px above and below */
      transform: translate(calc(-50% - var(--upc-fs-shift, 0px)), -50%);
      background: radial-gradient(closest-side, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.28) 55%, transparent);
      transition:
        opacity 0.2s ease,
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
        width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .vcenter.show:not(.inert) button {
      pointer-events: auto;
    }
    /* Measures --upc-fs-left (the host's: the left edge the system covers,
       an env() inset) for _leftInset - JS can't read env() itself. */
    .vinset {
      position: absolute;
      left: 0;
      top: 0;
      width: var(--upc-fs-left, 0px);
      height: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .vc-skip {
      width: calc(75px * var(--vc-k, 1));
      height: calc(75px * var(--vc-k, 1));
    }
    .vc-skip-icon {
      display: block;
      width: calc(41px * var(--vc-k, 1));
      height: calc(41px * var(--vc-k, 1));
      fill: currentColor;
    }
    .vc-play {
      width: calc(97px * var(--vc-k, 1));
      height: calc(97px * var(--vc-k, 1));
    }
    .vc-play ha-icon {
      --mdc-icon-size: calc(60px * var(--vc-k, 1));
    }
    /* The bottom bar is only its centred group (and, on a clip, the seek bar
       above it): its shade is .vshade, under the strip. It takes no taps itself
       (the strip under it stays draggable); its buttons and seek bar do. */
    .vctrl.card {
      flex-direction: column;
      justify-content: flex-end;
      gap: calc(20px * var(--vc-k, 1));
      padding: calc(20px * var(--vc-k, 1)) calc(48px * var(--vc-k, 1)) calc(40px * var(--vc-k, 1));
      z-index: 6;
      pointer-events: none;
      background: none;
    }
    .vctrl.card.show:not(.inert) button,
    .vctrl.card.show:not(.inert) .vseek {
      pointer-events: auto;
    }
    /* The clip players' seek bar, iPhone-player style: elapsed on the left,
       what is left on the right, a white bar that thickens while dragged. */
    .vc-seek {
      align-self: stretch;
      display: flex;
      align-items: center;
      gap: calc(14px * var(--vc-k, 1));
    }
    /* (.vctrl.card: outranks the fullscreen bar's .vctrl.fs .vtime.) */
    .vctrl.card .vc-seek .vtime {
      margin: 0;
      min-width: 3.2em;
      font-size: calc(19px * var(--vc-k, 1));
      color: rgba(255, 255, 255, 0.85);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }
    .vctrl.card .vc-seek .vtime.left {
      text-align: right;
    }
    .vc-seek .vseek {
      margin: 0;
      height: calc(32px * var(--vc-k, 1));
    }
    .vc-seek .vseek-track {
      height: calc(6px * var(--vc-k, 1));
      border-radius: calc(3px * var(--vc-k, 1));
      background: rgba(255, 255, 255, 0.3);
      transition: height 0.2s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .vc-seek .vseek.drag .vseek-track {
      height: calc(10px * var(--vc-k, 1));
      border-radius: calc(5px * var(--vc-k, 1));
    }
    .vc-seek .vseek-fill {
      border-radius: inherit;
      background: rgba(255, 255, 255, 0.92);
    }
    .vc-seek .vseek-knob {
      width: calc(16px * var(--vc-k, 1));
      height: calc(16px * var(--vc-k, 1));
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    }
    /* "View in Timeline": a text pill, like the speed pill. */
    .vctrl.card button.vc-tl {
      width: auto;
      padding: 0 calc(22px * var(--vc-k, 1));
      border-radius: calc(29px * var(--vc-k, 1));
      font-size: calc(18px * var(--vc-k, 1));
      font-weight: 600;
      white-space: nowrap;
    }
    /* A clip's shade reaches higher: the seek bar sits above the buttons. */
    .vshade.seek {
      height: calc(230px * var(--vc-k, 1));
    }
    .vctrl-group {
      display: flex;
      align-items: center;
      gap: calc(28px * var(--vc-k, 1));
      transform: translateX(calc(-1 * var(--upc-bar-shift, 0px)));
      transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    /* The camera screen's: centred AS A WHOLE on the middle row's axis,
       whatever it holds - talk comes with live, exit with somewhere to go
       back to (user, 2026-10-31: without exit it hung off to the left). Its
       buttons are all one size, so a button's place is its index: --i of
       --n, a button and a gap apart around the axis (the group is that axis,
       0 wide). A change in the count slides them there - transform only -
       while talk keeps its slot when away (.off) and shrinks out, or grows
       back, where it stands. */
    .vctrl-group.axis {
      display: block;
      position: relative;
      width: 0;
      height: calc(57px * var(--vc-k, 1));
    }
    .vg-slot {
      --x: calc((var(--i) - (var(--n) - 1) / 2) * 85px * var(--vc-k, 1));
      position: absolute;
      top: 0;
      left: calc(-28.5px * var(--vc-k, 1));
      transform: translateX(var(--x));
      transition:
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
        opacity 0.2s ease;
    }
    .vg-slot.off {
      opacity: 0;
      visibility: hidden; /* not hit-testable */
      transform: translateX(var(--x)) scale(0.5);
      transition:
        transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1),
        opacity 0.15s ease,
        visibility 0s linear 0.15s;
    }
    /* No room for the middle row (the phone's upright screen with the events
       panel open): it steps aside until there is. */
    .vcenter.crowded,
    .vcshade.crowded {
      opacity: 0;
      visibility: hidden;
    }
    .vcenter.crowded button {
      pointer-events: none !important;
    }
    /* The phone's camera screen kept UPRIGHT (portrait footage): the bar runs
       full width along the bottom, clear of the home indicator, and the
       timeline and the events panel end above it (--upc-fs-ctrl-h: the bar's
       measured height, _syncUprightCtrl); both start below the status bar. */
    :host([upright]) .vctrl.card {
      padding-bottom: calc(40px * var(--vc-k, 1) + env(safe-area-inset-bottom, 0px));
    }
    :host([upright]) .fs-tl,
    :host([upright]) .fs-side {
      bottom: var(--upc-fs-ctrl-h, 0px);
    }
    :host([upright]) .fs-tl {
      padding-top: calc(var(--upc-fs-tl-pad, 20px) + env(safe-area-inset-top, 0px));
    }
    :host([upright]) .vshade {
      height: calc(var(--upc-fs-ctrl-h, 0px) + 40px);
    }
    /* ...and the picture fills the space ABOVE the bar, where they end, not
       the whole screen: running on under the bar it met their backgrounds in
       a step (user, 2026-10-30). Below it all is black, the bar's own. */
    :host([upright]) video,
    :host([upright]) canvas.sprite,
    :host([upright]) canvas.freeze,
    :host([upright]) .overlay {
      /* (A height, not a bottom: a <video> or <canvas> left at height auto
         takes its own aspect's height and sits at the top.) */
      height: calc(100% - var(--upc-fs-ctrl-h, 0px));
      box-sizing: border-box;
    }
    /* ...whose top row is back / play-pause / forward (the floating middle
       row's buttons, at their own size - not the bar's). */
    .vc-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: calc(56px * var(--vc-k, 1));
    }
    .vctrl.card .vc-row button.vc-skip {
      width: calc(75px * var(--vc-k, 1));
      height: calc(75px * var(--vc-k, 1));
    }
    .vctrl.card .vc-row button.vc-play {
      width: calc(97px * var(--vc-k, 1));
      height: calc(97px * var(--vc-k, 1));
    }
    .vctrl.card .vc-row .vc-play ha-icon {
      --mdc-icon-size: calc(60px * var(--vc-k, 1));
    }
    /* The phone's clip card: its picture at the TOP (a landscape clip's seek
       bar and buttons sit in the strip below it - see multi-view), the middle
       row on the picture's centre (--upc-vc-top), and a seek bar a finger
       can hold: a tall grab area, a bigger knob. */
    :host([stacked][roundctrl]) video {
      object-position: 50% 0;
    }
    /* ...whose black is the card's own (the picture's box and the strip are
       separate layers there, see multi-view). */
    :host([stacked][roundctrl]) .stage,
    :host([stacked][roundctrl]) video {
      background: transparent;
    }
    :host([stacked][roundctrl]) .overlay {
      bottom: auto;
      box-sizing: border-box;
      height: calc(2 * var(--upc-vc-top, 50%));
    }
    /* Its seek bar runs the card's full width (16px in from its edges), the
       times UNDER it at either end - the iPhone player's layout. */
    :host([stacked][roundctrl]) .vctrl.card {
      padding: 0 16px 24px;
      gap: 12px;
    }
    :host([stacked][roundctrl]) .vc-seek {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
    }
    :host([stacked][roundctrl]) .vc-seek .vseek {
      grid-row: 1;
      grid-column: 1 / -1;
      height: 40px;
    }
    :host([stacked][roundctrl]) .vctrl.card .vc-seek .vtime {
      grid-row: 2;
      margin-top: -10px;
      min-width: 0;
      font-size: 13px;
      text-align: right;
    }
    :host([stacked][roundctrl]) .vctrl.card .vc-seek .vtime.left {
      grid-column: 1;
      text-align: left;
    }
    :host([stacked][roundctrl]) .vc-seek .vseek-knob {
      width: 18px;
      height: 18px;
    }
    :host([stacked][roundctrl]) .vc-seek .vseek-track {
      height: 5px;
    }
    :host([stacked][roundctrl]) .vc-seek .vseek.drag .vseek-track {
      height: 8px;
    }
    .vctrl.card button {
      width: calc(57px * var(--vc-k, 1));
      height: calc(57px * var(--vc-k, 1));
    }
    .vctrl.card button ha-icon {
      --mdc-icon-size: calc(33px * var(--vc-k, 1));
    }
    /* Speed: a round button like the others (user, 2026-10-30), its "×"
       smaller so "1×" sits comfortably in it. */
    .vctrl.card .vctrl-speed {
      min-width: 0;
      padding: 0;
      font-size: calc(20px * var(--vc-k, 1));
    }
    .vctrl.card .vctrl-speed .vx {
      font-size: 0.7em;
      margin-left: 0.04em;
    }
    /* Above 1x: the overlay's own deep accent (its pills, zoom and live
       buttons, the date pill) — the bright one is meant for thin lines. */
    .vctrl.card .vctrl-speed.on {
      background: var(--upc-accent-deep, var(--upc-accent, var(--primary-color, #03a9f4)));
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
    /* Sound ON: the speaker button reversed — white with a black icon — so
       "you can hear this" reads at a glance against the muted (dark) look. */
    .vctrl button.vmute {
      transition:
        background 0.2s ease,
        color 0.2s ease;
    }
    .vctrl button.vmute.on {
      background: #fff;
      color: #000;
    }
    .vctrl button.vmute.on:hover {
      background: #e6e6e6;
    }
    /* Talk (cameras with a speaker, live only): a microphone next to the
       speaker, crossed out like a muted speaker while off, on a red background
       while talking. */
    .vctrl button.vtalk {
      transition: background 0.2s ease;
    }
    .vctrl button.vtalk.talking {
      background: #d9534f;
    }
    .vctrl button.vtalk.talking:hover {
      background: #c9403b;
    }
    /* Upright phone fullscreen (the doorbell): with Talk the row holds seven
       controls, which only fit a ~390px screen slightly tighter. */
    :host([stacked]) .fs-wrap.fs-active.upright .vctrl.has-talk {
      gap: 6px;
    }
    :host([stacked]) .fs-wrap.fs-active.upright .vctrl.has-talk button {
      width: 44px;
      height: 44px;
    }
    :host([stacked]) .fs-wrap.fs-active.upright .vctrl.has-talk .vctrl-speed {
      min-width: 49px;
      padding: 0 8px;
    }
    /* Why talking stopped (no microphone, permission denied, time limit...):
       above the control bar, fading in and out. */
    .vtalk-msg {
      position: absolute;
      left: 50%;
      bottom: calc(var(--upc-fs-ctrl-h, 64px) + 12px);
      transform: translate(-50%, 6px);
      max-width: calc(100% - 32px);
      padding: 8px 14px;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      font-size: 14px;
      text-align: center;
      opacity: 0;
      transition:
        opacity 0.25s ease,
        transform 0.25s ease;
      pointer-events: none;
      z-index: 7;
    }
    .vtalk-msg.show {
      opacity: 1;
      transform: translate(-50%, 0);
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
    :host([stacked]) .vctrl:not(.card) {
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
    /* UPRIGHT phone fullscreen (portrait footage — see _rotateForFs): the bar
       is ONE full-width row on the bottom screen edge, clear of the home
       indicator. Not inset like the other layouts: the timeline ends ABOVE it
       (.fs-tl below), so there is nothing to keep clear of — and the inset would
       crush six controls into half a narrow screen. The .fs-inset selector
       outranks the inset rule above. */
    :host([stacked]) .fs-wrap.fs-active.upright .vctrl,
    :host([stacked]) .fs-wrap.fs-active.upright .vctrl.fs-inset {
      padding: 14px 12px calc(16px + env(safe-area-inset-bottom, 0px));
    }
    /* ...and the timeline runs down the right edge from below the notch to just
       above that bar (--upc-fs-ctrl-h: its measured height, _syncUprightCtrl). */
    .fs-wrap.fs-active.upright .fs-tl {
      bottom: var(--upc-fs-ctrl-h, 0px);
      padding-top: calc(var(--upc-fs-tl-pad, 100px) + env(safe-area-inset-top, 0px));
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
  p({ attribute: !1 })
], f.prototype, "hass", 2);
g([
  p()
], f.prototype, "nvrId", 2);
g([
  p()
], f.prototype, "cameraId", 2);
g([
  p({ attribute: !1 })
], f.prototype, "gaps", 2);
g([
  p({ type: Number })
], f.prototype, "targetTime", 2);
g([
  p({ type: Boolean })
], f.prototype, "scrubbing", 2);
g([
  p({ type: Boolean })
], f.prototype, "live", 2);
g([
  p({ type: Boolean })
], f.prototype, "canTalk", 2);
g([
  p({ type: Number })
], f.prototype, "now", 2);
g([
  p()
], f.prototype, "previewDir", 2);
g([
  p()
], f.prototype, "previewMode", 2);
g([
  p()
], f.prototype, "fastPreview", 2);
g([
  p({ type: Boolean })
], f.prototype, "tipEnabled", 2);
g([
  p({ type: Number })
], f.prototype, "clipEndTime", 2);
g([
  p()
], f.prototype, "accent", 2);
g([
  p()
], f.prototype, "liveAudioStart", 2);
g([
  p({ type: Boolean, reflect: !0 })
], f.prototype, "stacked", 2);
g([
  p({ type: Boolean })
], f.prototype, "startFs", 2);
g([
  p({ type: Boolean })
], f.prototype, "fsHandoff", 2);
g([
  p({ type: Boolean })
], f.prototype, "fsTimeline", 2);
g([
  p({ type: Number })
], f.prototype, "fsTimelineWidth", 2);
g([
  p({ type: Number })
], f.prototype, "fsTimelineGrabWidth", 2);
g([
  p({ type: Number })
], f.prototype, "fsTimelinePadding", 2);
g([
  p({ type: Number })
], f.prototype, "fsTimelineGutter", 2);
g([
  p({ type: Number })
], f.prototype, "fsTimelineScrim", 2);
g([
  p({ type: Number })
], f.prototype, "fsTimelineScrimExtend", 2);
g([
  p({ type: Boolean, reflect: !0, attribute: "cardfs" })
], f.prototype, "cardFs", 2);
g([
  p({ type: Boolean })
], f.prototype, "cardFsExit", 2);
g([
  p({ type: Boolean })
], f.prototype, "cardFsClose", 2);
g([
  p({ type: Boolean, reflect: !0, attribute: "roundctrl" })
], f.prototype, "roundCtrl", 2);
g([
  p({ type: Boolean })
], f.prototype, "closable", 2);
g([
  p({ type: Boolean, reflect: !0 })
], f.prototype, "phone", 2);
g([
  p({ type: Boolean, reflect: !0 })
], f.prototype, "upright", 2);
g([
  p({ attribute: !1 })
], f.prototype, "poster", 2);
g([
  p({ type: Boolean, reflect: !0, attribute: "chromehidden" })
], f.prototype, "chromeHidden", 2);
g([
  p({ type: Boolean, reflect: !0, attribute: "chromeaside" })
], f.prototype, "chromeAside", 2);
g([
  m()
], f.prototype, "_uprightBarH", 2);
g([
  m()
], f.prototype, "_posterOn", 2);
g([
  m()
], f.prototype, "_posterGone", 2);
g([
  p({ type: Number })
], f.prototype, "fsSide", 2);
g([
  p({ type: Boolean })
], f.prototype, "holdCtrl", 2);
g([
  m()
], f.prototype, "_tlReach", 2);
g([
  m()
], f.prototype, "_hostW", 2);
g([
  m()
], f.prototype, "_leftInset", 2);
g([
  m()
], f.prototype, "_hostH", 2);
g([
  m()
], f.prototype, "_error", 2);
g([
  tt(".fs-wrap")
], f.prototype, "_fsDlg", 2);
g([
  tt("video.main")
], f.prototype, "_mainVideo", 2);
g([
  tt("video.preview-a")
], f.prototype, "_previewVidA", 2);
g([
  tt("video.preview-b")
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
], f.prototype, "_talk", 2);
g([
  m()
], f.prototype, "_talkMsg", 2);
g([
  m()
], f.prototype, "_talkMsgOn", 2);
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
  tt("canvas.sprite")
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
  tt("canvas.freeze")
], f.prototype, "_freezeCanvas", 2);
f = g([
  mt("upc-media-view")
], f);
var Ra = Object.defineProperty, za = Object.getOwnPropertyDescriptor, N = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? za(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && Ra(t, i, o), o;
};
const La = 3e4, Fa = 2 * 6e4, Oa = 136, Ia = 12, Da = 450, fs = 16, qt = 14, ms = (e) => (e.tablet_events_thumbnail_size ?? 145) + 168;
let D = class extends Z {
  constructor() {
    super(...arguments), this.stacked = !1, this._data = /* @__PURE__ */ new Map(), this._strip = [], this._loaded = !1, this._expanded = !1, this._lastPlayedKey = "", this._minuteTick = 0, this._thumbVersion = 0, this._gridView = 2, this._gridUnder = !1, this._closing = !1, this._chromeHidden = !1, this._xfToken = 0, this._lastPlayedCam = "", this._loader = new as(2, () => {
      this._thumbVersion++;
    }), this._lastSyncTrigger = 0, this._fetchSeq = 0, this._savedScroll = [], this._keepLastPlayed = !1, this._onStripSelect = (e) => {
      this._openClip(e.detail);
    }, this._dismiss = async () => {
      if (!this._playback || this._closing) return;
      const e = this._wrapEl(), t = e?.querySelector("upc-media-view");
      if (!e || !t) {
        this._closePlayback();
        return;
      }
      const i = ++this._xfToken, s = ct(e, this), o = t.videoBox();
      if (this._closing = !0, this._chromeHidden = !0, this._gridUnder = !1, this._clearUnder(), await this.updateComplete, i !== this._xfToken) return;
      const r = this._thumbEl(this._lastPlayedKey);
      let a;
      r ? (a = ke(e, ct(r, this), s, o, { out: !0 }), e.querySelector(".card-strip")?.animate([{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], {
        duration: U,
        fill: "forwards"
      })) : a = e.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.94)" }], {
        duration: U,
        easing: X(),
        fill: "forwards"
      }), this.renderRoot.querySelector(".playoverlay .scrim")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: U, easing: X(), fill: "forwards" });
      const n = this.renderRoot.querySelector("upc-live-grid");
      n && (n.getAnimations().forEach((h) => h.cancel()), Dt(n, !0, 700)), await a.finished.catch(() => {
      }), i === this._xfToken && (this._closing = !1, this._chromeHidden = !1, this._closePlayback());
    }, this._toggling = !1, this._onToggleExpand = async () => {
      if (this.stacked) return this._toggleStacked();
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
      } else {
        const e = [this.renderRoot.querySelector(".events-pane"), this.renderRoot.querySelector(".tablet .body")];
        await Promise.all(
          e.map(
            (t) => t?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-in", fill: "forwards" }).finished.catch(() => {
            })
          )
        ), this._closePlayback(), this._expanded = !0;
      }
    }, this._closePlayback = () => {
      this._playback = void 0, this._eventSpan = void 0;
    }, this._onTileOpen = (e) => {
      const t = e.detail.navigation_path;
      if (t) {
        Vt(t);
        return;
      }
      let i;
      const s = e.composedPath()[0], o = s.tileOf?.(e.detail.camera);
      if (this._saveScroll(), this._suspendedFor = this._openedFrom = "tile", o) {
        const r = o.getBoundingClientRect();
        i = { el: o, content: { x: 0, y: 0, w: r.width, h: r.height }, view: this._tileView(s) };
      }
      this.dispatchEvent(
        new CustomEvent("camera-open", { detail: { camera: e.detail.camera, from: i }, bubbles: !0, composed: !0 })
      );
    }, this._onFsHandoff = (e) => {
      this._saveScroll(), this._suspendedFor = this._openedFrom = "clip";
      const t = e.composedPath()[0], i = { el: t, content: t.videoBox(), poster: t.snapshot() ?? void 0 };
      this._xfToken++, this._chromeHidden = !0, this._clearUnder(), this.dispatchEvent(
        new CustomEvent("camera-fullscreen-at", {
          detail: { ...e.detail, from: i },
          bubbles: !0,
          composed: !0
        })
      );
    };
  }
  connectedCallback() {
    if (super.connectedCallback(), this._refreshTimer = setInterval(() => void this._fetchAll(), La), this._minuteTimer = setInterval(() => {
      this._minuteTick++;
    }, 6e4), this.hasUpdated) {
      if (this._suspendedFor) {
        const e = this._suspendedFor === "clip";
        this._suspendedFor = void 0, e && (this._keepLastPlayed = !0), this._revealing = this._revealLastPlayed(e);
      } else
        this._resetToMain();
      this._fetchAll();
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback(), clearInterval(this._refreshTimer), clearInterval(this._minuteTimer), clearTimeout(this._syncRefetchTimer), this._loader.cancelAll(), this._xfToken++, this._gridUnder = !1, this._closing = !1, this._chromeHidden = !1, this._clearUnder(), this._suspendedFor ? this._closePlayback() : this._resetToMain();
  }
  /** Remember every scrolled element in this page, and every scrolled
   *  ancestor (a popup or view that scrolls the page itself). Detaching the
   *  page — which the card does while the fullscreen timeline is up — resets
   *  scroll offsets, so "10 pages down, five days back" has to be put back by
   *  hand. The elements themselves survive (the card caches this page). */
  _saveScroll() {
    const e = [], t = (o) => {
      for (const r of Array.from(o.querySelectorAll("*")))
        (r.scrollTop || r.scrollLeft) && e.push([r, r.scrollTop, r.scrollLeft]), r.shadowRoot && t(r.shadowRoot);
    };
    t(this.renderRoot), (this.scrollTop || this.scrollLeft) && e.push([this, this.scrollTop, this.scrollLeft]);
    let i = this;
    for (; i; ) {
      const o = i.parentElement ?? (i.getRootNode().host || null);
      o instanceof Element && (o.scrollTop || o.scrollLeft) && e.push([o, o.scrollTop, o.scrollLeft]), i = o;
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
   *  (`reveal`) bring the clip that was playing into view and highlight it —
   *  in the grid, the tablet column, the phone carousel, whichever this page
   *  is showing. Restoring the old offsets alone is not enough: the strip had
   *  nothing to highlight and the exact item is what the viewer is looking
   *  for. */
  async _revealLastPlayed(e = !0) {
    await this.updateComplete;
    const t = Array.from(this.renderRoot.querySelectorAll("upc-event-strip, upc-events-list"));
    if (await Promise.all(t.map((i) => i.updateComplete)), await new Promise((i) => requestAnimationFrame(i)), this._restoreScroll(), !!e) {
      for (const i of t)
        if (i.revealKey(this._lastPlayedKey)) break;
    }
  }
  /** Return to the default main screen: no clip selected (live grid shown), not
   *  in the expanded events browser, default 2-column density, no last-played
   *  highlight. Used on every (re)entry so the view never resumes mid-clip. */
  _resetToMain() {
    this._closePlayback(), this._expanded = !1, this._lastPlayedKey = "", this._keepLastPlayed = !1, this._gridView = 2;
  }
  updated(e) {
    e.has("config") && this.config && (this._resetToMain(), this._fetchAll()), (e.has("_strip") || e.has("_loaded") || e.has("_expanded") || e.has("_gridView") || e.has("_playback") || e.has("stacked")) && this.dispatchEvent(
      new CustomEvent("events-head", {
        detail: {
          loaded: this._loaded,
          count: this._strip.length,
          expanded: this._expanded,
          gridView: this._gridView,
          liveGrid: !this._expanded && !this._playback
        },
        bubbles: !0,
        composed: !0
      })
    ), e.has("_expanded") && this._expanded && !this.stacked && this.renderRoot.querySelector(".events-scroll.grid")?.animate(
      [
        { opacity: 0, transform: "translateX(-30px)" },
        { opacity: 1, transform: "none" }
      ],
      { duration: 300, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    ), e.has("_expanded") && !this._expanded && e.get("_expanded") === !0 && !this.stacked && (this.renderRoot.querySelector(".tablet .body")?.animate(
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
    ), this.renderRoot.querySelector(".events-pane")?.animate(
      [
        { opacity: 0, transform: "translateX(-30px)" },
        { opacity: 1, transform: "none" }
      ],
      { duration: 300, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    ));
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
        return { e: a, loaded: n ? await ts(`${Fe}/${n}`) : void 0 };
      })
    );
    if (t !== this._fetchSeq) return;
    const s = (this.config?.event_merge_gap_seconds ?? 60) * 1e3, o = /* @__PURE__ */ new Map();
    let r = !1;
    for (const { e: a, loaded: n } of i)
      (!n || n.stale) && (r = !0), n && o.set(a.camera, {
        bands: ns(rs(n.entries.map(Qi), s), a.camera, this._name(a)),
        preMs: n.preMs,
        postMs: n.postMs
      });
    this._data = o, this._strip = Xo([...o.values()].map((a) => a.bands)), this._loaded = !0, this._thumbVersion++, r && this._requestSync();
  }
  /** Fire the pyscript sync service (throttled; it syncs ALL cameras) and
   *  re-check the manifests a few seconds later. No-ops without pyscript. */
  _requestSync() {
    if (!this.hass) return;
    const e = Date.now();
    e - this._lastSyncTrigger < Fa || (this._lastSyncTrigger = e, this.hass.callWS({ type: "call_service", domain: "pyscript", service: "protect_thumbs_sync" }).catch(() => {
    }), clearTimeout(this._syncRefetchTimer), this._syncRefetchTimer = setTimeout(() => void this._fetchAll(), 8e3));
  }
  _playBand(e) {
    this._playback = e, this._lastPlayedKey = `${e.type}@${e.start}`, this._lastPlayedCam = e.camera, this._keepLastPlayed = !1;
    const t = this._data.get(e.camera);
    this._eventSpan = {
      start: Math.max(e.start - (t?.preMs ?? 0), 0),
      end: Math.min(e.end + (t?.postMs ?? 0), Date.now())
    };
  }
  // ---- zoom transitions ----------------------------------------------------
  /** The player's box: in place of the cameras, or the lightbox. */
  _wrapEl() {
    return this.renderRoot.querySelector(".playwrap, .playbox");
  }
  /** A clip's thumbnail where it is on screen: the events list beside the
   *  cameras, or the events grid. */
  _thumbEl(e) {
    return this.renderRoot.querySelector("upc-events-list, upc-event-strip")?.thumbOf(e) ?? null;
  }
  /** A clip picked: the player's black box grows out of its thumbnail,
   *  dissolving out of it (the thumbnail is not the clip's first frame - often
   *  a square crop round the detection - so it is never shown blown up), and
   *  the clip fades in on its first frame. Already open on the same camera,
   *  the clip just fades in there. Tiles stay under the zoom, fading out. */
  async _openClip(e) {
    const t = ++this._xfToken, i = this._wrapEl();
    for (const M of [i, i?.querySelector(".card-strip"), this.renderRoot.querySelector(".playoverlay .scrim")])
      M?.getAnimations().forEach((W) => W.cancel());
    const s = `${e.type}@${e.start}`, o = this._thumbEl(s), r = !!this._playback && !this._closing, a = r && this._playback.camera === e.camera, n = r && !a ? this._wrapEl() : null, h = n?.querySelector("upc-media-view"), c = n && h ? this._dissolve(h.snapshot(), n, h.videoBox()) : this._clearUnder(), d = o ? ct(o, this) : null, l = this.stacked && !r && !this._expanded ? this.scrollTop : 0;
    this._closing = !1, this._gridUnder = !r && !this._expanded, this._chromeHidden = !a, this._playBand(e), await this.updateComplete;
    const _ = this._wrapEl(), v = _?.querySelector("upc-media-view");
    if (t !== this._xfToken || !_ || !v) return this._settleOpen(t);
    if (a) return this._settleOpen(t);
    await v.updateComplete, l && (this.scrollTop = 0);
    const w = ct(_, this), T = [];
    if (l)
      for (const M of [this.renderRoot.querySelector("upc-event-strip"), _.parentElement])
        M?.animate([{ transform: `translateY(${-l}px)` }, { transform: "none" }], {
          duration: U,
          easing: X()
        });
    if (d) {
      const M = this.stacked ? v.videoBox() : { x: 0, y: 0, w: w.w, h: w.h };
      T.push(ke(_, { ...d, y: d.y + l }, w, M)), _.querySelector(".card-strip")?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], {
        duration: U
      });
    } else
      T.push(
        _.animate([{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "none" }], {
          duration: U,
          easing: X()
        })
      );
    c?.ghost?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: U, easing: "ease-in", fill: "forwards" }), this.stacked && c?.box?.animate([{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], {
      duration: U,
      fill: "forwards"
    });
    const z = this.renderRoot.querySelector(".playoverlay .scrim");
    z && !r && T.push(z.animate([{ opacity: 0 }, { opacity: 1 }], { duration: U, easing: X() }));
    const O = this._gridUnder ? this.renderRoot.querySelector("upc-live-grid") : null;
    O && (O.getAnimations().forEach((M) => M.cancel()), Dt(O, !1, U)), await Promise.all(T.map((M) => M.finished.catch(() => {
    }))), this._settleOpen(t);
  }
  _settleOpen(e) {
    e === this._xfToken && (this._gridUnder = !1, this._chromeHidden = !1, this._clearUnder());
  }
  /** The previous camera's player (`wrap`, `content` its picture box),
   *  replaced: its black box stays where it was and its last frame dissolves
   *  on it, UNDER the next player zooming in - the new picture flies in over
   *  the old one. Cleared once it has landed. */
  _dissolve(e, t, i) {
    const s = this.renderRoot.querySelector(".under");
    if (!s) return;
    const o = ct(t, s), r = document.createElement("div");
    return r.className = "backdrop", Object.assign(r.style, { left: `${o.x}px`, top: `${o.y}px`, width: `${o.w}px`, height: `${o.h}px` }), s.replaceChildren(r), e ? (e.className = "ghost", Object.assign(e.style, {
      left: `${o.x + i.x}px`,
      top: `${o.y + i.y}px`,
      width: `${i.w}px`,
      height: `${i.h}px`
    }), s.append(e), { box: r, ghost: e }) : { box: r };
  }
  _clearUnder() {
    this.renderRoot?.querySelector(".under")?.replaceChildren();
  }
  /** Where the camera screen zooms back to on its way out: the clip it was
   *  opened from (that camera's), else - and always when a tile opened it -
   *  the camera's live tile (`view`: the grid it may be half scrolled out of),
   *  after the page has come back and scrolled to it. */
  async zoomTarget(e) {
    const t = this._openedFrom;
    if (this._openedFrom = void 0, this._suspendedFor = void 0, await this.updateComplete, await this._revealing, t !== "tile" && this._keepLastPlayed && this._lastPlayedCam === e) {
      const o = this._thumbEl(this._lastPlayedKey);
      if (o) return { el: o };
    }
    const i = this.renderRoot.querySelector("upc-live-grid");
    if (!i) return null;
    await i.updateComplete;
    const s = i.tileOf(e);
    return s ? { el: s, view: this._tileView(i) } : null;
  }
  /** What a live tile can be scrolled out of: the wide grid (it scrolls in
   *  its one-column mode), or - phone - this page, which scrolls as a whole. */
  _tileView(e) {
    return this.stacked ? this : e;
  }
  /** The card's heading: events grid <-> cameras. */
  toggleExpand() {
    this._onToggleExpand();
  }
  /** Phone: carousel + tiles <-> events grid, faded through. What shows fades
   *  out, the page swaps and goes back to its top; the grid then comes in -
   *  rising slightly - once the pictures on its first screen are in (asked for
   *  before it fades out), and the carousel simply fades back in, the tiles
   *  each on their own first frame (see live-grid). */
  async _toggleStacked() {
    if (!this._toggling) {
      this._toggling = !0;
      try {
        const e = !this._expanded, t = this.renderRoot.querySelector("upc-event-strip");
        e && t?.preload(Ia);
        const i = [t, this.renderRoot.querySelector(".body")].map(
          (o) => o?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease-in", fill: "forwards" })
        );
        await Promise.all(i.map((o) => o?.finished.catch(() => {
        }))), e && this._closePlayback(), this._expanded = e, await this.updateComplete, this.scrollTop = 0, e && await t?.firstScreenReady(Da);
        const s = t?.animate(
          e ? [
            { opacity: 0, transform: "translateY(14px)" },
            { opacity: 1, transform: "none" }
          ] : [{ opacity: 0 }, { opacity: 1 }],
          { duration: e ? 380 : 300, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );
        i.forEach((o) => o?.cancel()), await s?.finished.catch(() => {
        });
      } finally {
        this._toggling = !1;
      }
    }
  }
  /** The card's grid-density control (wide layout): the tablet live grid's
   *  density, 1 = full-width scroll, 2 = columns. The tiles re-flow (and
   *  restart their streams): out, switch, back in. */
  async setGridView(e) {
    if (e === this._gridView) return;
    const t = this.renderRoot.querySelector("upc-live-grid");
    t && await Dt(t, !1, 140).finished.catch(() => {
    }), this._gridView = e, await this.updateComplete;
    const i = this.renderRoot.querySelector("upc-live-grid");
    i && (i.getAnimations().forEach((s) => s.cancel()), Dt(i, !0, 520));
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
    const i = this.config.accent_color ?? "#fc9df3", s = this._playback, o = s ? `${s.type}@${s.start}` : "", r = s ? s.camera : "", a = s ? this._data.get(s.camera) : void 0, n = {};
    for (const c of e) n[c.camera] = this._data.get(c.camera)?.bands[0];
    if (!this.stacked) return this._renderTablet(e, i, s, o, r, a, n);
    const h = s ? this._clipShape(s.camera) : "";
    return u`
      <upc-event-strip
        captions
        hideHead
        .loaded=${this._loaded}
        .bands=${this._strip}
        .loader=${this._loader}
        .thumbVersion=${this._thumbVersion}
        .headerText=${this.config.strip_title ?? "Events"}
        .thumbSize=${this.config.mobile_events_thumbnail_size ?? 0}
        .timeSize=${this.config.strip_time_size ?? 12}
        .itemTextSize=${(this.config.list_text_size ?? 12) + 1}
        .playingKey=${o}
        .lastPlayedKey=${this._lastPlayedKey}
        .keepLastPlayed=${this._keepLastPlayed}
        .expanded=${this._expanded}
        .gridColumns=${2}
        .accent=${i}
        @strip-select=${this._onStripSelect}
        @toggle-expand=${this._onToggleExpand}
      ></upc-event-strip>
      ${this._expanded ? s ? u`<div class="playoverlay" @click=${this._dismiss}>
              <div class="scrim"></div>
              ${It(
      r,
      u`<div class="playbox" style=${h} @click=${(c) => c.stopPropagation()}>
                  <div class="card-pic"></div>
                  <div class="card-strip"></div>
                  ${this._renderPlayer(s, a, i)}
                </div>`
    )}
            </div>` : b : u`<div class="body ${s ? "playing" : ""}">
            <div class="under"></div>
            ${!s || this._gridUnder || this._closing ? u`<upc-live-grid
                  class="bleed"
                  .hass=${this.hass}
                  .entries=${e}
                  .stacked=${!0}
                  .newest=${n}
                  .minuteTick=${this._minuteTick}
                  .aspect=${this.config.grid_aspect ?? "16/9"}
                  @tile-open=${this._onTileOpen}
                ></upc-live-grid>` : b}
            ${s ? It(
      r,
      u`<div class="playwrap" style=${h}>
                    <div class="card-pic"></div>
                    <div class="card-strip"></div>
                    ${this._renderPlayer(s, a, i)}
                  </div>`
    ) : b}
          </div>`}
      <div class="foot"></div>
    `;
  }
  /** The phone's clip card for a camera's footage: full width at its aspect,
   *  plus the control strip below the picture for landscape footage (portrait
   *  footage is tall enough to carry its controls over its foot). */
  _clipShape(e) {
    const t = this.hass?.states?.[e]?.attributes, i = Number(t?.width) || 16, s = Number(t?.height) || 9;
    return `--upc-clip-ar:${i} / ${s};--upc-clip-strip:${s > i ? 0 : Oa}px`;
  }
  /** Tablet (wide) layout. Collapsed: the timeline-identical events LIST on the
   *  left (ALL cameras merged) + the live grid (or the clip player) on the right
   *  — click an event to play it on the right. Expanded (chevron): the events
   *  become a full-width grid to browse, cameras unmounted. */
  _renderTablet(e, t, i, s, o, r, a) {
    const n = this.config, h = n.tablet_events_thumbnail_size ?? 145, c = n.tablet_events_grid_thumbnail_size ?? Math.round(h * 1.5), d = n.list_text_size ?? 12, l = Math.max(1, d - 1), _ = this._gridView === 1 ? 1 : 2;
    return this._expanded ? u`
        <div class="tablet expanded">
          <div class="events-pane">
            <div class="events-scroll grid">
              <upc-event-strip
                expanded
                hideHead
                gridCaptions
                captions
                .bands=${this._strip}
                .loader=${this._loader}
                .thumbVersion=${this._thumbVersion}
                .timeSize=${n.strip_time_size ?? 12}
                .playingKey=${s}
                .lastPlayedKey=${this._lastPlayedKey}
                .keepLastPlayed=${this._keepLastPlayed}
                .expanded=${!0}
                .gridThumbWidth=${c}
                .dateFontSize=${n.date_font_size ?? 13}
                .itemTextSize=${d}
                .accent=${t}
                @strip-select=${this._onStripSelect}
              ></upc-event-strip>
            </div>
          </div>
          ${i ? u`<div class="playoverlay" @click=${this._dismiss}>
                <div class="scrim"></div>
                ${It(
      o,
      u`<div class="playbox" @click=${(v) => v.stopPropagation()}>
                    ${this._renderPlayer(i, r, t)}
                  </div>`
    )}
              </div>` : b}
        </div>
      ` : u`
      <div class="tablet">
        <div class="events-pane" style="flex-basis:${ms(n)}px">
          <div class="events-scroll">
            <upc-events-list
              .bands=${this._strip}
              .loader=${this._loader}
              .thumbVersion=${this._thumbVersion}
              .textSize=${d}
              .textColor=${n.list_text_color ?? ""}
              .durationSize=${l}
              .durationColor=${n.list_duration_color ?? ""}
              .showCamera=${!0}
              .line1White=${!0}
              .activeTextSize=${n.list_active_text_size ?? 12}
              .activeTextColor=${n.list_active_text_color ?? "#000"}
              .activeDurationSize=${n.list_active_duration_size ?? 12}
              .activeDurationColor=${n.list_active_duration_color ?? "#000"}
              .activeBg=${n.list_active_bg ?? n.list_highlight_color ?? "#fff"}
              .playingKey=${s || (this._keepLastPlayed ? this._lastPlayedKey : "")}
              .dateFontSize=${n.date_font_size ?? 13}
              .dateFontColor=${n.date_font_color ?? "#ffffff"}
              .dividerColor=${t}
              .thumbWidth=${h}
              @event-selected=${this._onStripSelect}
            ></upc-events-list>
          </div>
        </div>
        <div class="body">
          <div class="under"></div>
          ${!i || this._gridUnder || this._closing ? u`<upc-live-grid
                .hass=${this.hass}
                .entries=${e}
                .stacked=${!1}
                .newest=${a}
                .minuteTick=${this._minuteTick}
                .columns=${_}
                .scrollMode=${_ === 1}
                .aspect=${this.config.grid_aspect ?? "16/9"}
                @tile-open=${this._onTileOpen}
              ></upc-live-grid>` : b}
          ${i ? It(o, u`<div class="playwrap">${this._renderPlayer(i, r, t)}</div>`) : b}
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
    return u`<upc-media-view
      style="--upc-accent-deep:${Ie(i, 0.58) || i}"
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
      .roundCtrl=${!0}
      .closable=${!0}
      .chromeHidden=${this._chromeHidden}
      @fullscreen-handoff=${this._onFsHandoff}
      @player-close=${this._dismiss}
    ></upc-media-view>`;
  }
};
D.styles = ft`
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px; /* clear separation between the event strip and the live grid */
      min-height: 0;
    }
    /* What a camera switch leaves UNDER the next player while it zooms in
       (see _dissolve): the old player's black box and its last frame (one
       GPU-side copy, fading out), where they were. */
    .under {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .under > .backdrop {
      position: absolute;
      background: #000;
      border-radius: 10px; /* the player's stage */
    }
    .under > .ghost {
      position: absolute;
      object-fit: contain;
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
    /* ...while a clip plays: the rest of the page under the strip (its card's
       height is capped to it - a portrait clip at full width can be taller). */
    :host([stacked]) .body.playing {
      flex: 1 1 auto;
      min-height: 0;
    }
    upc-live-grid,
    .playwrap {
      position: absolute;
      inset: 0;
    }
    /* Stacked: the grid sits in normal flow at its natural height. */
    :host([stacked]) upc-live-grid {
      position: static;
      height: auto;
    }
    /* The phone's clip card: edge to edge like the tiles, black, in the clip's
       own shape (--upc-clip-ar: full width at its aspect) plus - landscape
       footage - a strip below the picture for its seek bar and buttons
       (--upc-clip-strip; the picture is drawn at the top, see media-view), so
       they have room and leave the picture alone. Positioned: it paints over
       tiles still under it. */
    :host([stacked]) .playwrap {
      position: relative;
      inset: auto;
      margin: 0 -12px;
      aspect-ratio: var(--upc-clip-ar, 16 / 9);
      padding-bottom: var(--upc-clip-strip, 0px);
      max-height: calc(100% - var(--upc-clip-strip, 0px));
    }
    /* Its black: the picture's box, and the control strip below it - a layer
       of its own, so a zoom flies the picture alone (the strip fades in once
       it lands and out as it leaves). The strip reaches up behind the
       picture's rounded foot, so at rest they read as one card. */
    .card-pic,
    .card-strip {
      position: absolute;
      left: 0;
      right: 0;
      background: #000;
    }
    .card-pic {
      top: 0;
      bottom: var(--upc-clip-strip, 0px);
      border-radius: 10px;
    }
    .card-strip {
      bottom: 0;
      height: calc(var(--upc-clip-strip, 0px) + 10px);
      border-radius: 0 0 10px 10px;
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
    /* Tiles kept under a clip's card zooming open or shut (see _gridUnder)
       ride out of the flow from the top of the body, fading. */
    :host([stacked]) .body.playing upc-live-grid.bleed {
      position: absolute;
      top: 0;
      left: -12px;
      right: -12px;
      margin: 0;
    }
    /* The page's foot: clear of the screen's rounded bottom corners (and the
       home indicator) - with the gap before it, max(20px, the safe area). */
    :host([stacked]) .foot {
      flex: 0 0 auto;
      height: max(0px, calc(env(safe-area-inset-bottom, 0px) - 20px));
    }
    upc-media-view {
      position: absolute;
      inset: 0;
    }
    /* Expanded-grid playback: a lightbox OVER the grid (the grid stays put).
       position:fixed resolves against the nearest containing ancestor — the
       mobile view's fixed card, the wide card (contain: layout, card.ts) — so
       the scrim covers the card, not the sidebar beside it. */
    .playoverlay {
      position: fixed;
      inset: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    /* Its dimming: a layer of its own, so it fades by opacity alone. */
    .playoverlay > .scrim {
      position: absolute;
      inset: 0;
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
    /* Phone: the same card as in place of the tiles (full width, the clip's
       shape and control strip), centred in the page under the header - which
       stays visible, dimmed - and clear of the screen's foot. */
    :host([stacked]) .playoverlay {
      padding: calc(env(safe-area-inset-top, 0px) + 68px) 0 max(20px, env(safe-area-inset-bottom, 0px));
    }
    :host([stacked]) .playbox {
      width: 100%;
      aspect-ratio: var(--upc-clip-ar, 16 / 9);
      padding-bottom: var(--upc-clip-strip, 0px);
      max-height: calc(100% - var(--upc-clip-strip, 0px));
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
      gap: ${fs}px;
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
    /* ...and the live cameras fill the whole right of the card, like the UniFi
       app: GRID_EDGE clear of the pane's top and of the card's right and bottom
       edges (12 = the card's padding, card.ts styles). The left needs nothing -
       the events pane's own padding already separates them. height:auto lets
       the insets size it (the grid's own height:100% would win over bottom).
       The grid-density control lives in the card's header row. */
    .tablet upc-live-grid {
      top: ${qt}px;
      right: ${qt - 12}px;
      bottom: ${qt - 12}px;
      height: auto;
    }
  `;
N([
  p({ attribute: !1 })
], D.prototype, "hass", 2);
N([
  p({ attribute: !1 })
], D.prototype, "config", 2);
N([
  p({ type: Boolean, reflect: !0 })
], D.prototype, "stacked", 2);
N([
  m()
], D.prototype, "_data", 2);
N([
  m()
], D.prototype, "_strip", 2);
N([
  m()
], D.prototype, "_loaded", 2);
N([
  m()
], D.prototype, "_playback", 2);
N([
  m()
], D.prototype, "_expanded", 2);
N([
  m()
], D.prototype, "_lastPlayedKey", 2);
N([
  m()
], D.prototype, "_minuteTick", 2);
N([
  m()
], D.prototype, "_thumbVersion", 2);
N([
  m()
], D.prototype, "_gridView", 2);
N([
  m()
], D.prototype, "_gridUnder", 2);
N([
  m()
], D.prototype, "_closing", 2);
N([
  m()
], D.prototype, "_chromeHidden", 2);
N([
  m()
], D.prototype, "_keepLastPlayed", 2);
N([
  m()
], D.prototype, "_eventSpan", 2);
D = N([
  mt("upc-multi-view")
], D);
var Ba = Object.defineProperty, Ua = Object.getOwnPropertyDescriptor, E = (e, t, i, s) => {
  for (var o = s > 1 ? void 0 : s ? Ua(t, i) : t, r = e.length - 1, a; r >= 0; r--)
    (a = e[r]) && (o = (s ? a(t, i, o) : a(o)) || o);
  return s && o && Ba(t, i, o), o;
};
const Na = 3e4, Wi = 0.4, Ha = u`<svg viewBox="0 0 24 24">
  <rect x="4" y="5" width="16" height="5.5" rx="1.5"></rect>
  <rect x="4" y="13.5" width="16" height="5.5" rx="1.5"></rect>
</svg>`, Va = u`<svg viewBox="0 0 24 24">
  <rect x="4" y="5" width="6.6" height="14" rx="1.5"></rect>
  <rect x="13.4" y="5" width="6.6" height="14" rx="1.5"></rect>
</svg>`, Wa = 6e4, qa = 100, ja = 52, Ga = 40, Ka = 72, Ya = 84, $e = 12, Xa = 24, bt = 28, Za = 150, Ja = 160, Qa = 500, tn = 2 * 6e4, en = "3.2.0", sn = 2e3, on = 1e3, rn = 33, an = 1.3, nn = 1.15;
let Et = 0, qi = "", $ = class extends Z {
  constructor() {
    super(...arguments), this._gaps = [], this._targetTime = Date.now(), this._scrubbing = !1, this._liveMode = !0, this._livePaused = !1, this._now = Date.now(), this._nvrId = "", this._mode = "timeline", this._activeCamera = "", this._swapDir = 0, this._xf = null, this._panelChromeHidden = !1, this._xfToken = 0, this._galleryOpen = !1, this._eventsOpen = !1, this._eventsMounted = !1, this._calOpen = !1, this._zoomPanel = !1, this._calCursor = { y: 0, m: 0 }, this._hostWidth = 0, this._hostHeight = 0, this._thumbVersion = 0, this._clipEnd = 0, this._manifestBands = [], this._preMs = 0, this._postMs = 0, this._lastSyncTrigger = 0, this._loader = new as(2, () => {
      this._thumbVersion++;
    }), this._inited = !1, this._gapsAt = 0, this._gapsDir = "", this._multiHead = {
      loaded: !1,
      count: 0,
      expanded: !1,
      gridView: 2,
      liveGrid: !0
    }, this._toggleMultiEvents = () => {
      this.renderRoot.querySelector("upc-multi-view")?.toggleExpand();
    }, this._goBack = () => {
      if (this._isMulti && this._drill) {
        this._xf !== "out" && this._zoomOut();
        return;
      }
      const e = this._config?.back_button_path;
      if (e) {
        Vt(e);
        return;
      }
      const t = this._config?.back_fallback_path || `/${window.location.pathname.split("/")[1] ?? ""}`;
      if (window.history.length <= 1) {
        Vt(t);
        return;
      }
      const i = window.location.href;
      window.history.back(), window.setTimeout(() => {
        window.location.href === i && this.isConnected && Vt(t);
      }, 400);
    }, this._onMediaFsExit = () => {
      this._goBack();
    }, this._pageBgApplied = !1, this._scrubPreviewScheduler = new Ao(
      rn,
      (e) => {
        this._targetTime = e;
      }
    ), this._toggleCal = () => {
      if (this._calOpen && this.renderRoot?.querySelector(".cal-pop.fs")?.getAnimations().length) {
        this._calToken++, this._calClosing = !1, this.renderRoot.querySelector(".cal-pop.fs")?.getAnimations().forEach((t) => t.cancel()), window.addEventListener("pointerdown", this._outsideCalClose, !0);
        return;
      }
      if (this._calOpen) {
        this._closeCal();
        return;
      }
      const e = new Date(this._domain ? A(this._domain, this._phFrac()) : Date.now());
      this._calCursor = { y: e.getFullYear(), m: e.getMonth() }, this._calOpen = !0, window.addEventListener("pointerdown", this._outsideCalClose, !0);
    }, this._calToken = 0, this._calClosing = !1, this._outsideCalClose = (e) => {
      const t = e.composedPath(), i = this.renderRoot.querySelector(".cal-pop"), s = this.renderRoot.querySelector(".date-pill");
      i && t.includes(i) || s && t.includes(s) || (e.preventDefault(), e.stopPropagation(), we(), this._closeCal());
    }, this._onLivePlaying = (e) => {
      this._livePaused = !e.detail.playing, e.detail.playing && this._liveMode && !this._scrubbing && this._domain && (this._now = Date.now(), this._domain = j(this._now, L(this._domain), this._phFrac()));
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
      const e = this._domain, t = j(this._now, L(e), this._phFrac());
      this._domain = t, this._targetTime = this._now, this._glideRulers(e, t, on), this._scrubbing = !1, this._liveMode = !0, this._livePaused = !1, this._playingBand = void 0, this._clearClip();
    }, this._onRewind = (e) => {
      this._rewindTo(e.detail.time);
    }, this._onPanelEventSelected = (e) => {
      this._rewindTo(Math.min(e.detail.start, Date.now())), this._playingBand = e.detail;
    }, this._onPlaybackTime = (e) => {
      if (this._liveMode || this._scrubbing || !this._domain) return;
      const t = this._domain, i = j(e.detail.time, L(t), this._phFrac());
      this._domain = i, Math.abs(
        A(i, this._phFrac()) - A(t, this._phFrac())
      ) >= sn && this._glideRulers(t, i);
    }, this._onPlaybackSeek = (e) => {
      if (!this._domain) return;
      const t = this._domain, i = j(e.detail.time, L(t), this._phFrac());
      this._domain = i, this._glideRulers(t, i);
    }, this._toggleEvents = () => {
      this._eventsOpen = !this._eventsOpen;
    }, this._toggleCamSheet = () => {
      if (this._galleryOpen) {
        this._closeCamSheet();
        return;
      }
      this._galleryOpen = !0, window.addEventListener("pointerdown", this._outsideSheetClose, !0);
    }, this._outsideSheetClose = (e) => {
      const t = e.composedPath(), i = this.renderRoot.querySelector(".fs-cams-body"), s = this.renderRoot.querySelector(".fs-cams-handle");
      if (!this._galleryOpen || !i) {
        window.removeEventListener("pointerdown", this._outsideSheetClose, !0);
        return;
      }
      t.includes(i) || s && t.includes(s) || (e.preventDefault(), e.stopPropagation(), we(), this._closeCamSheet());
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
    this._config = e, e.debug && vo(() => this.hass), this._activeCamera = e.camera, this._drill = void 0, this._galleryOpen = !1, this._closeCal(), this._inited = !1;
  }
  get _isMulti() {
    return this._config?.card_version === "multi";
  }
  _setMultiGridView(e) {
    this.renderRoot.querySelector("upc-multi-view")?.setGridView(e);
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
  _drillTo(e, t = !1, i, s) {
    this._xfToken++, this._xf = null, this._drill = e, this._activeCamera = e, this._nvrId = this._resolveNvrId(), this._loader.cancelAll(), this._manifestBands = [], this._gaps = [], this._gapsAt = 0, this._preMs = 0, this._postMs = 0, this._lastSyncTrigger = 0, this._resetToLive(), i !== void 0 && this._domain && i < Date.now() - 3e3 && (this._liveMode = !1, this._targetTime = i, this._domain = j(i, L(this._domain), this._phFrac())), this._fetchGaps(!0), this._fetchManifest(), s ? (this._swapDir = 0, this._zoomIn(s)) : this._swapDir = t ? 0 : 1;
  }
  /** What a camera-screen flight moves - the tablet's panel itself, the
   *  phone's frame inside it - and the angle it stands at (90: sideways). */
  _flyer(e) {
    const t = e.querySelector(":scope > .frame");
    return t ? { el: t, angle: e.classList.contains("turned") ? 90 : 0 } : { el: e, angle: 0 };
  }
  /** A screen rect in the coordinates of a flyer's own layer (its .hero,
   *  which fills it): plain offsets, or - the phone's sideways frame - turned
   *  back with it. */
  _layerBox(e, t) {
    const i = e.el.getBoundingClientRect();
    return e.angle ? ar(t, i, e.el.offsetWidth, e.el.offsetHeight) : { x: t.left - i.left, y: t.top - i.top, w: t.width, h: t.height };
  }
  /** A camera picked in the camera screen's picker: its picture flies out of
   *  the tile into the screen as the picker closes, and stays there (the
   *  player's poster) until the camera's first frame. */
  async _pickCamera(e, t) {
    if (e === this._activeCamera) {
      this._closeCamSheet();
      return;
    }
    const i = t.querySelector("img"), s = i?.currentSrc || i?.src, o = this.renderRoot.querySelector("ha-card.panel"), r = o ? this._flyer(o) : void 0, a = i && s && r ? this._layerBox(r, i.getBoundingClientRect()) : null, n = ++this._xfToken;
    if (this._panelPoster = void 0, this._selectCamera(e), this._closeCamSheet(), !a || !s || !r) return;
    await this.updateComplete;
    const h = this.renderRoot.querySelector("ha-card.panel"), c = h?.querySelector("upc-media-view"), d = h?.querySelector(".hero");
    if (n !== this._xfToken || !h || !c || !d) return;
    const l = this._flyer(h);
    if (l.angle !== r.angle) {
      l.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: U, easing: "ease-out" });
      return;
    }
    await c.updateComplete;
    const _ = c.videoBox(), v = document.createElement("img");
    v.src = s, v.className = "ghost", Object.assign(v.style, { left: `${_.x}px`, top: `${_.y}px`, width: `${_.w}px`, height: `${_.h}px` }), d.append(v), await ke(v, a, _, { x: 0, y: 0, w: _.w, h: _.h }).finished.catch(() => {
    }), n === this._xfToken && (this._panelPoster = s), setTimeout(() => v.remove(), 300);
  }
  /** The camera screen zooms open out of `from` (see _xf) - turning as it
   *  grows, into the phone's sideways screen. */
  async _zoomIn(e) {
    const t = ++this._xfToken, i = this.getBoundingClientRect(), s = sr(e, this), o = e.view ? ct(e.view, this) : null, r = o && xi(s, o) || s, a = { x: r.x + i.left, y: r.y + i.top, w: r.w, h: r.h };
    this._panelPoster = e.poster, this._panelChromeHidden = !0, this._xf = "in", await this.updateComplete;
    const n = this.renderRoot.querySelector("ha-card.panel"), h = n?.querySelector("upc-media-view");
    if (t !== this._xfToken || !n || !h) return this._settleZoom(t);
    await h.updateComplete;
    const c = this._flyer(n), d = e.poster ? h.videoBox() : { x: 0, y: 0, w: c.el.offsetWidth, h: c.el.offsetHeight }, l = ki(c.el, a, d, c.angle);
    this.renderRoot.querySelector(".xf-dim")?.animate([{ opacity: 0 }, { opacity: Wi }], { duration: U, easing: X(), fill: "forwards" }), await l.finished.catch(() => {
    }), this._settleZoom(t);
  }
  _settleZoom(e) {
    e === this._xfToken && (this._xf = null, this._panelChromeHidden = !1);
  }
  /** The camera screen zooms back into where it came from (the clip it was
   *  opened from, else its camera's live tile) - or, with neither on screen,
   *  shrinks away - over the multi page coming back under it. */
  async _zoomOut() {
    const e = ++this._xfToken, t = this._activeCamera, i = this.renderRoot.querySelector("ha-card.panel"), s = i?.querySelector("upc-media-view");
    if (!i || !s) {
      this._drillOut(!0);
      return;
    }
    const o = this._flyer(i), r = s.videoBox();
    this._panelChromeHidden = !0, this._xf = "out", await this.updateComplete;
    const a = this.renderRoot.querySelector("upc-multi-view"), n = a ? await a.zoomTarget(t) : null;
    if (e !== this._xfToken) return;
    const h = n ? yi(n.el.getBoundingClientRect()) : null, c = h && n?.view ? xi(h, yi(n.view.getBoundingClientRect())) : h;
    let d;
    if (c)
      d = ki(o.el, c, r, o.angle, { out: !0 });
    else {
      const l = `rotate(${o.angle}deg)`;
      d = o.el.animate(
        [
          { opacity: 1, transform: `${l} scale(1)` },
          { opacity: 0, transform: `${l} scale(0.94)` }
        ],
        { duration: U, easing: X(), fill: "forwards" }
      );
    }
    this.renderRoot.querySelector(".xf-dim")?.animate([{ opacity: Wi }, { opacity: 0 }], { duration: U, easing: X(), fill: "forwards" }), await d.finished.catch(() => {
    }), e === this._xfToken && (this._xf = null, this._panelChromeHidden = !1, this._panelPoster = void 0, this._drillOut(!0));
  }
  /** Drilled timeline → back to the multi page (slide in from the left). */
  _drillOut(e = !1) {
    this._drill = void 0, this._activeCamera = this._config?.camera ?? "", this._loader.cancelAll(), this._swapDir = e ? 0 : -1;
  }
  /** Where the playhead sits down the strip. Lower on the phone's camera
   *  screen so the active event's thumbnail clears the top fade (see
   *  PHONE_FS_PLAYHEAD_FRAC). ONE value for the card's domain math and the
   *  timeline — they must agree, or the marker and the footage drift apart. */
  _phFrac() {
    return this._hostWidth && this._phoneScreen() ? ao : ie;
  }
  /** The phone's camera screen (stacked layout) turns sideways for landscape
   *  footage on an upright phone - you turn the phone to watch (iOS can't lock
   *  the orientation from a web page) - and stays upright for PORTRAIT footage,
   *  which would play sideways in a small band. Decided by the camera's own
   *  resolution (its entity's width/height, else the video's), never per
   *  camera; unknown footage turns. A landscape window never turns. */
  _phoneTurned() {
    if (!this._isStacked() || window.innerHeight <= window.innerWidth) return !1;
    const e = this._footageSize(this._activeCamera || this._config?.camera || "");
    return !(e && e[1] > e[0]);
  }
  /** A camera's footage size: its entity's resolution (what the player shows),
   *  else the camera screen's video once it has a frame. */
  _footageSize(e) {
    const t = this.hass?.states?.[e]?.attributes, i = Number(t?.width) || 0, s = Number(t?.height) || 0;
    return i > 0 && s > 0 ? [i, s] : this.renderRoot?.querySelector("ha-card.panel upc-media-view")?.footageSize();
  }
  _canTalk(e) {
    const t = this.hass?.entities, i = this._talkCache;
    if (i && i.entities === t && i.camera === e) return i.can;
    const s = ko(this.hass, e);
    return this._talkCache = { entities: t, camera: e, can: s }, s;
  }
  /** The phone's camera screen kept UPRIGHT (portrait footage, see
   *  _phoneTurned): the ruler runs down the right edge of a ~390px-wide screen
   *  instead of along the turned screen's ~840px one, so its lane is slimmer. */
  _fsUpright() {
    return this._isStacked() && !this._phoneTurned();
  }
  /** Clearance the fullscreen ruler keeps from the top/bottom screen edges.
   *  Per layout — see the block in render(), its only caller. */
  _fsPad() {
    return this._config?.fs_timeline_padding ?? (this._phoneScreen() ? 20 : 60);
  }
  /** The lane between the ruler and the right screen edge — it has to fit the
   *  zoom control and the jump-to-live arrow with room to breathe. On a phone
   *  that edge is also iOS's system-gesture strip: a button sitting in it never
   *  receives the touch at all, so the lane is wide enough to keep the whole
   *  control column clear of it. (Upright, that edge is a plain screen edge —
   *  iOS's strip is the bottom one — so the lane only has to fit the controls.) */
  _fsGutter() {
    return this._config?.fs_timeline_gutter !== void 0 ? this._config.fs_timeline_gutter : this._fsUpright() ? ja : this._phoneScreen() ? 110 : 140;
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
      tablet_events_grid_thumbnail_size: 218,
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
      fs_close_button: !1,
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
      talk_button: !0,
      debug: !1,
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
    Et === 0 && (qi = t.style.backgroundColor), Et++, t.style.backgroundColor = e, this._pageBgApplied = !0;
  }
  _removePageBackground() {
    this._pageBgApplied && (this._pageBgApplied = !1, Et--, Et <= 0 && (Et = 0, document.documentElement.style.backgroundColor = qi));
  }
  connectedCallback() {
    super.connectedCallback(), this._applyPageBackground(), this._tick = setInterval(() => this._onTick(), 1e3), this._bandInterval = setInterval(() => {
      this._isMulti && !this._drill || (this._fetchGaps(!0), this._fetchManifest());
    }, Na), this._hostRo = new ResizeObserver((e) => {
      const t = e[e.length - 1].contentRect, i = Math.round(t.width), s = Math.round(t.height);
      i && i !== this._hostWidth && (this._hostWidth = i), s && s !== this._hostHeight && (this._hostHeight = s);
    }), this._hostRo.observe(this), this.hasUpdated && this._config && !this._isMulti && (this._resetToLive(), this._fetchGaps(!0), this._fetchManifest());
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._removePageBackground(), clearInterval(this._tick), clearInterval(this._bandInterval), clearTimeout(this._syncRefetchTimer), clearTimeout(this._scrubSettleTimer);
    const e = this._pendingScrubCommit;
    this._pendingScrubCommit = void 0, e?.(), this._scrubPreviewScheduler.reset(), this._hostRo?.disconnect(), window.removeEventListener("pointerdown", this._outsideCalClose, !0), window.removeEventListener("pointerdown", this._outsideSheetClose, !0), this._loader.cancelAll();
  }
  updated(e) {
    if ((e.has("hass") || e.has("_config")) && this.hass && this._config && !this._inited && this._init(), e.has("_xf") && (this._xf ? this.setAttribute("xf", this._xf) : this.removeAttribute("xf")), e.has("_calOpen") && this._calOpen && this._calFlight(!0), this._swapDir) {
      const t = this._swapDir;
      this._swapDir = 0, this.renderRoot.querySelector("ha-card")?.animate(
        [{ transform: `translateX(${t * 100}%)` }, { transform: "translateX(0)" }],
        { duration: 450, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
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
    this._mode = "timeline", this._closeCamSheet(), this._eventsOpen = !1, this._calOpen = !1, this._now = Date.now(), this._domain = j(this._now, this._initialSpan(), this._phFrac()), this._targetTime = this._now, this._scrubbing = !1, this._liveMode = !0, this._livePaused = !1, this._playingBand = void 0, this._clearClip();
  }
  /** Server-side cache dir: explicit config, else /protect_thumbs/<cam id>.
   *  The explicit dir only applies to the CONFIG camera — when the gallery strip
   *  switched to another camera, its cache dir must be derived from that
   *  camera's object_id or every camera would share one manifest. */
  _cacheDir() {
    if (this._config?.thumbnail_cache_dir && this._activeCamera === this._config.camera)
      return this._config.thumbnail_cache_dir;
    const e = this._activeCamera?.split(".")[1];
    return e ? `${Fe}/${e}` : "";
  }
  /** Scrub-preview cache dir (pyscript protect_scrub job): explicit config for
   *  the CONFIG camera, else /protect_scrub/<object_id> — same per-camera
   *  derivation as _cacheDir. Empty string = preview disabled. */
  _scrubDir() {
    if (this._config?.scrub_preview === !1) return "";
    if (this._config?.scrub_preview_dir && this._activeCamera === this._config.camera)
      return this._config.scrub_preview_dir;
    const e = this._activeCamera?.split(".")[1];
    return e ? `${to}/${e}` : "";
  }
  /** Load the event manifest (the NVR's own event list, mirrored by the pyscript
   *  sync job). Cheap static file. If it's missing or stale (job not running /
   *  not run yet), ask the sync service to run now — that's the "event exists on
   *  the NVR but isn't cached yet" retrieval path. */
  async _fetchManifest() {
    const e = this._cacheDir();
    if (!e) return;
    const t = this._activeCamera, i = await ts(e);
    if (t === this._activeCamera) {
      if (i) {
        this._preMs = i.preMs, this._postMs = i.postMs;
        const s = (this._config?.event_merge_gap_seconds ?? 60) * 1e3;
        this._manifestBands = rs(i.entries.map(Qi), s), this._thumbVersion++;
      }
      (!i || i.stale) && this._requestSync();
    }
  }
  /** Fire the pyscript sync service (throttled) and re-check the manifest a few
   *  seconds later. No-ops silently when pyscript isn't installed. */
  _requestSync() {
    if (!this.hass) return;
    const e = Date.now();
    e - this._lastSyncTrigger < tn || (this._lastSyncTrigger = e, this.hass.callWS({ type: "call_service", domain: "pyscript", service: "protect_thumbs_sync" }).catch(() => {
    }), clearTimeout(this._syncRefetchTimer), this._syncRefetchTimer = setTimeout(() => void this._fetchManifest(), 8e3));
  }
  /** Initial visible span: default_timeline_zoom (0–100) wins, else minutes. */
  _initialSpan() {
    const e = this._config?.default_timeline_zoom;
    if (e != null) {
      const t = Math.max(0, Math.min(100, e)), i = Math.round((1 - t / 100) * (q.length - 1));
      return q[i];
    }
    return this._config?.default_span_minutes != null ? no(this._config.default_span_minutes * $t) : q[0];
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
  /** The camera screen's events panel's items: this camera's events as the
   *  multi page's grid shows them (camera name, time · duration) - re-made
   *  only when the events or the camera change. */
  _panelBands(e) {
    const t = this._panelBandsMemo;
    if (t?.bands === this._viewBands && t.camera === e) return t.out;
    const i = ns(this._viewBands, e, this._cameraName(e));
    return this._panelBandsMemo = { bands: this._viewBands, camera: e, out: i }, i;
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
    e !== this._activeCamera && (this._activeCamera = e, this._nvrId = this._resolveNvrId(), this._loader.cancelAll(), this._manifestBands = [], this._gaps = [], this._gapsAt = 0, this._preMs = 0, this._postMs = 0, this._lastSyncTrigger = 0, this._liveMode || !this._domain ? this._onLive() : (this._cancelSettle(), this._playingBand = void 0, this._clearClip(), this._livePaused = !1, this._scrubbing = !1, this._targetTime = Math.min(A(this._domain, this._phFrac()), Date.now())), this._fetchGaps(!0), this._fetchManifest());
  }
  _closeCal() {
    window.removeEventListener("pointerdown", this._outsideCalClose, !0);
    const e = this.renderRoot?.querySelector(".cal-pop.fs");
    if (!e || !this._calOpen) {
      this._calOpen = !1;
      return;
    }
    const t = ++this._calToken;
    this._calClosing = !0, (this._calFlight(!1) ?? e.animate([{ opacity: 1, scale: "1" }, { opacity: 0, scale: "0.92" }], {
      duration: 170,
      easing: "ease-in",
      fill: "forwards"
    })).finished.catch(() => {
    }).then(() => {
      t === this._calToken && (this._calOpen = !1, this._calClosing = !1);
    });
  }
  // the calendar on its way out
  /** The phone's calendar (.cal-modal) between its date pill and the middle
   *  of the screen: opening, it grows out of the pill and the backdrop dims
   *  in; closing, it shrinks back into the pill as the backdrop clears.
   *  Undefined where there is no modal (the tablet's pops over its pill). */
  _calFlight(e) {
    const t = this.renderRoot.querySelector(".cal-modal"), i = t?.querySelector(".cal-pop"), s = this.renderRoot.querySelector("ha-card.panel");
    if (!t || !i || !s) return;
    const o = e ? "none" : "forwards";
    t.style.pointerEvents = e ? "" : "none";
    const r = t.querySelector(".cal-scrim");
    r?.getAnimations().forEach((c) => c.cancel()), i.getAnimations().forEach((c) => c.cancel()), r?.animate([{ opacity: e ? 0 : 1 }, { opacity: e ? 1 : 0 }], {
      duration: e ? Math.round(Xt * 0.7) : Zt,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: o
    });
    const a = this.renderRoot.querySelector(".date-pill.fs")?.getBoundingClientRect(), n = { x: i.offsetLeft, y: i.offsetTop, w: i.offsetWidth, h: i.offsetHeight }, h = a?.width ? this._layerBox(this._flyer(s), a) : { x: n.x + n.w * 0.04, y: n.y + n.h * 0.04, w: n.w * 0.92, h: n.h * 0.92 };
    return ir(i, h, n, { x: 0, y: 0, w: n.w, h: n.h }, e);
  }
  /** Previous / next month: the month on show slides away and the new one
   *  slides in behind it, from the side it comes from - a copy of the old
   *  title and days leaves while the real ones, already showing the new
   *  month, come in (so quick taps simply chain). */
  _calShift(e) {
    const t = this.renderRoot.querySelector(".cal-pop");
    t?.querySelectorAll(".cal-ghost").forEach((r) => r.remove());
    const i = t ? Array.from(t.querySelectorAll(".cal-title, .cal-days")) : [], s = 28 * e;
    for (const r of i) {
      const a = r.cloneNode(!0);
      a.classList.add("cal-ghost"), Object.assign(a.style, { left: `${r.offsetLeft}px`, top: `${r.offsetTop}px`, width: `${r.offsetWidth}px` }), t.append(a), a.animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: `translateX(${-s}px)` }
        ],
        { duration: 200, easing: "ease-in", fill: "forwards" }
      ).finished.catch(() => {
      }).then(() => a.remove());
    }
    const o = new Date(this._calCursor.y, this._calCursor.m + e, 1);
    this._calCursor = { y: o.getFullYear(), m: o.getMonth() }, this.updateComplete.then(() => {
      for (const r of i)
        r.getAnimations().forEach((a) => a.cancel()), r.animate(
          [
            { opacity: 0, transform: `translateX(${s}px)` },
            { opacity: 0, transform: `translateX(${s}px)`, offset: 0.25 },
            { opacity: 1, transform: "none" }
          ],
          { duration: 340, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
    });
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
      const h = s + 864e5;
      if (h > Date.now()) {
        this._onLive();
        return;
      }
      let c;
      for (const d of this._viewBands)
        d.start >= s && d.start < h && (!c || d.start > c.start) && (c = d);
      c && this._playBand(c);
      return;
    }
    const o = new Date(e, t, i, 12, 0, 0, 0).getTime(), r = Math.min(Date.now(), new Date(e, t, i + 1).getTime()), a = hi(this._gaps) !== void 0 ? li(this._gaps, s, r, o) ?? o : o;
    if (a >= Date.now() - 2e4) {
      this._onLive();
      return;
    }
    this._playingBand = void 0, this._clearClip(), this._scrubbing = !1, this._livePaused = !1, this._liveMode = !1, this._targetTime = a, this._domain = j(a, L(this._domain), this._phFrac()), this._fetchGaps(!1);
  }
  // ---- live tick & band fetching -----------------------------------------
  _onTick() {
    this._now = Date.now(), this._liveMode && !this._scrubbing && !this._livePaused && this._domain && (this._domain = j(this._now, L(this._domain), this._phFrac()));
  }
  /** Fetch the camera's recording gaps (the grey "no footage" spans) from its
   *  scrub index — every span the NVR holds no footage for, across the whole
   *  cache window, so panning needs no refetch. One small static file, NOT an
   *  NVR call, re-read at most every GAPS_REFRESH_MS (the job rewrites it every
   *  15 s) unless forced. (Events themselves come from the manifest — see
   *  _fetchManifest.) */
  async _fetchGaps(e = !1) {
    if (!this.hass || !this._domain || !(this._config?.show_footage_gaps ?? !0)) return;
    const t = this._scrubDir(), i = Date.now();
    if (!e && t === this._gapsDir && i - this._gapsAt < Wa) return;
    this._gapsDir = t, this._gapsAt = i;
    const s = await _o(t);
    t === this._scrubDir() && (this._gaps = s);
  }
  /** Supersede a pending settle (a newer action decides the state instead). */
  _cancelSettle() {
    clearTimeout(this._scrubSettleTimer), this._pendingScrubCommit = void 0;
  }
  /** Continuous footage from `t` — no clip, no seek bar, playing on — with the
   *  ruler gliding there. */
  _rewindTo(e) {
    if (!this._domain) return;
    this._scrubPreviewScheduler.reset(), this._cancelSettle(), this._liveMode = !1, this._livePaused = !1, this._scrubbing = !1, this._playingBand = void 0, this._clearClip(), this._targetTime = e;
    const t = this._domain, i = j(e, L(t), this._phFrac());
    this._domain = i, this._glideRulers(t, i);
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
    this._domain && (this._scrubPreviewScheduler.reset(), this._cancelSettle(), this._scrubbing = !1, this._liveMode = !1, this._playingBand = e, this._clipEnd = Math.min(e.end + this._postMs, Date.now()), this._targetTime = Math.max(e.start - this._preMs, 0), this._domain = j(e.start, L(this._domain), this._phFrac()));
  }
  /** Leave event playback: no event end (the media view plays on regardless). */
  _clearClip() {
    this._clipEnd = 0;
  }
  /** The multi-camera page (card_version: multi): same ha-card + header shell
   *  (title, optional back button) as the single card, with <upc-multi-view>
   *  (event strip + live grid / clip playback) filling the rest. */
  _renderMulti() {
    const e = this._config, t = this._isStacked(), i = e.height || (t ? "100dvh" : "80vh"), s = (e.title_font_weight ? `--upc-title-weight:${e.title_font_weight};` : "") + (e.title_font_size ? `--upc-title-size:${e.title_font_size}px;` : "") + (e.title_font_color ? `--upc-title-color:${e.title_font_color};` : ""), o = this._multiHead, r = e.back_button ? u`<button
          class="back-btn"
          aria-label="Back"
          style=${`--upc-back-size:${e.back_button_size ?? 38}px`}
          @click=${this._goBack}
        >
          <ha-icon icon="mdi:chevron-left"></ha-icon>
        </button>` : b, a = (h, c, d) => u`
      <button
        class=${o.gridView === h ? "on" : ""}
        title=${c}
        @click=${() => this._setMultiGridView(h)}
      >
        ${d}
      </button>
    `, n = u`<button
      class="head-link"
      title=${o.expanded ? "Show cameras" : "Browse all events"}
      @click=${this._toggleMultiEvents}
    >
      <span class="title-text">${e.strip_title ?? "Events"}</span>
      <span class="head-count ${o.loaded ? "" : "pending"}">(${o.count})</span>
      <span class="head-chev ${o.expanded ? "open" : ""} ${o.loaded ? "" : "pending"}">
        <ha-icon icon="mdi:chevron-right"></ha-icon>
      </span>
    </button>`;
    return u`
      <ha-card class=${t ? "multi-stacked" : "multi-wide"} style=${`height:${i}`}>
        <div class="header" style=${s}>
          ${t ? u`${r}${n}` : (
      // Wide layout: the heading sits over the events pane, and the live
      // cameras' density control over the cameras.
      u`<div class="head-events" style=${`flex-basis:${ms(e)}px`}>
                  ${r} ${n}
                </div>
                <div class="head-cams">
                  <div class="grid-view ${o.liveGrid ? "" : "hidden"}">
                    ${a(1, "Single column", Ha)} ${a(2, "Two columns", Va)}
                  </div>
                </div>`
    )}
        </div>
        <upc-multi-view
          .hass=${this.hass}
          .config=${e}
          .stacked=${t}
          @events-head=${(h) => {
      this._multiHead = h.detail;
    }}
          @camera-open=${(h) => this._drillTo(h.detail.camera, !1, void 0, h.detail.from)}
          @camera-fullscreen-at=${(h) => this._drillTo(h.detail.camera, !0, h.detail.time, h.detail.from)}
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
  /** A phone's screen, for the camera screen's SIZES: the stacked layout, or
   *  a card too short for the tablet's (a phone held in landscape with its
   *  rotation unlocked - the same ~844 x 390 the sideways screen gets). */
  _phoneScreen() {
    return this._isStacked() || this._hostHeight > 0 && this._hostHeight < Qa;
  }
  /** One gallery tile: snapshot (HA camera proxy) + uppercase name. `closes`:
   *  picking it also closes the picker (the wide layout's camera sheet). */
  _renderCamTile(e, t, i = !1) {
    const s = this.hass.states[e.camera]?.attributes?.entity_picture, o = this._galleryOpen ? Math.floor(this._now / 1e4) : 0, r = s ? `${s}${s.includes("?") ? "&" : "?"}upc=${o}` : void 0, a = this._cameraName(e.camera);
    return u`<button
      class="cam-tile ${e.camera === t ? "active" : ""}"
      @click=${(n) => {
      if (i) {
        this._pickCamera(e.camera, n.currentTarget);
        return;
      }
      this._selectCamera(e.camera);
    }}
    >
      ${r ? u`<img src=${r} alt=${a} />` : u`<div class="cam-ph"></div>`}
      <span class="cam-name">${a}</span>
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
   *  mode-aware too (see _selectCalDay). `fs`: the wide camera screen's, opening
   *  up from the date pill at the foot of the overlay ruler. `modal`: the
   *  phone's, in the middle of its screen (always six week rows, so a month
   *  change never resizes it). */
  _renderCalendar(e = !1, t = !1) {
    const { y: i, m: s } = this._calCursor, o = /* @__PURE__ */ new Date();
    o.setHours(0, 0, 0, 0);
    const r = new Date(o);
    r.setDate(r.getDate() - (this._config?.calendar_days ?? 30));
    const a = new Date(i, s, 1), n = a.getDay(), h = new Date(i, s + 1, 0).getDate(), c = new Date(this._domain ? A(this._domain, this._phFrac()) : Date.now()), d = (y) => c.getFullYear() === i && c.getMonth() === s && c.getDate() === y, l = Wt({
      month: "long",
      year: "numeric"
    }).format(a), _ = Array.from(
      { length: 7 },
      (y, S) => Wt({ weekday: "narrow" }).format(new Date(2023, 0, S + 1))
    ), v = this._mode === "list" ? this._eventDayKeys() : void 0, w = !!v && v.size > 0, T = this._gaps, z = hi(T), O = Date.now(), M = (y) => {
      const S = y.getTime(), V = Math.min(O, new Date(y.getFullYear(), y.getMonth(), y.getDate() + 1).getTime());
      return S < V && li(T, S, V, S) !== void 0;
    }, W = i * 12 + s, G = z !== void 0 ? new Date(z) : r;
    let H = G.getFullYear() * 12 + G.getMonth();
    if (w) {
      let y = 1 / 0;
      for (const S of v) S < y && (y = S);
      H = Math.floor(y / 1e4) * 12 + Math.floor(y % 1e4 / 100);
    }
    const et = W > H, Y = W < o.getFullYear() * 12 + o.getMonth(), B = [];
    for (let y = 0; y < n; y++) B.push(u`<span class="cal-cell"></span>`);
    for (let y = 1; y <= h; y++) {
      const S = new Date(i, s, y), V = w ? v.has(i * 1e4 + s * 100 + y) : z !== void 0 ? M(S) : S <= o && S >= r;
      B.push(
        u`<button
          class="cal-cell cal-day ${d(y) ? "sel" : ""}"
          ?disabled=${!V}
          @click=${() => this._selectCalDay(i, s, y)}
        >
          ${y}
        </button>`
      );
    }
    if (t) for (; B.length < 42; ) B.push(u`<span class="cal-cell"></span>`);
    return u`<div class="cal-pop ${e ? "fs" : this._isStacked() ? "" : "wide"}">
      <div class="cal-head">
        <span class="cal-title">${l}</span>
        <span>
          <button class="cal-chev" ?disabled=${!et} @click=${() => this._calShift(-1)}>
            <ha-icon icon="mdi:chevron-left"></ha-icon>
          </button>
          <button class="cal-chev" ?disabled=${!Y} @click=${() => this._calShift(1)}>
            <ha-icon icon="mdi:chevron-right"></ha-icon>
          </button>
        </span>
      </div>
      <div class="cal-grid">${_.map((y) => u`<span class="cal-cell cal-wk">${y}</span>`)}</div>
      <div class="cal-grid cal-days">${B}</div>
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
   *  for across-the-room reading, and its own jump-to-live arrow. `foot`: what
   *  the overlay carries at the foot of its ruler (the wide camera screen's
   *  date pill). */
  _renderScrubber(e, t = b) {
    const i = this._config, s = i.tick_size, o = typeof s == "number" ? s : { small: 4, medium: 8, large: 14 }[s ?? "medium"] ?? 8, r = this._phoneScreen();
    return u`
      <upc-scrubber-timeline
        slot=${e ? "fs-timeline" : b}
        ?mirror=${e}
        .zoomUi=${!0}
        .gutter=${e ? this._fsGutter() : 0}
        .rotated=${e && this._phoneTurned()}
        .liveArrow=${e}
        .compact=${r}
        .playheadFrac=${this._phFrac()}
        .domain=${this._domain}
        .bands=${this._viewBands}
        .gaps=${i.show_footage_gaps ?? !0 ? this._gaps : []}
        .gapColor=${i.gap_color ?? "#4a4a52"}
        .now=${this._now}
        .hass=${this.hass}
        .nvrId=${this._nvrId}
        .cameraId=${this._activeCamera || i.camera}
        .loader=${this._loader}
        .thumbVersion=${this._thumbVersion}
        .fontSize=${Math.round(
      (i.timeline_font_size ?? 12) * (e ? r ? nn : an : 1)
    )}
        .fontColor=${i.timeline_font_color ?? "#d0d0d0"}
        .accentColor=${i.accent_color ?? "#fc9df3"}
        .tickColor=${e ? (
      // The card's tick color is picked against the timeline column's dark
      // background; over bright footage it disappears. The overlay's ruler
      // matches its own labels instead (light, like the UniFi app).
      i.timeline_font_color ?? "#d0d0d0"
    ) : i.tick_color ?? "#4f4f4f"}
        .tickSize=${o}
        .recordedColor=${i.recorded_color ?? "#6e476a"}
        .futureColor=${i.future_color ?? "#7a7a84"}
        .thumbSize=${e && this._fsUpright() ? Math.min(i.thumb_size ?? 87, Ka) : i.thumb_size ?? 87}
        .thumbSizeActive=${e && this._fsUpright() ? Math.min(i.thumb_size_active ?? 105, Ya) : i.thumb_size_active ?? 105}
        .live=${this._liveMode}
        .livePaused=${this._livePaused}
        .indent=${e ? 0 : r ? 75 : 60}
        .pillIndent=${e ? 0 : r ? 35 : 0}
        @scrub-start=${this._onScrubStart}
        @scrub=${this._onScrub}
        @scrub-end=${this._onScrubEnd}
        @scrub-cancel=${this._onScrubCancel}
        @domain-change=${this._onDomainChange}
        >${t}</upc-scrubber-timeline
      >
    `;
  }
  render() {
    return this._config ? this._isMulti ? u`${Js(this._drill && !this._xf ? b : this._renderMulti())}${this._xf ? u`<div class="xf-dim"></div>` : b}${this._drill ? this._renderSingle() : b}` : this._renderSingle() : b;
  }
  /** The single-camera page: a camera card, or the multi page drilled in. */
  _renderSingle() {
    if (!this._config) return b;
    if (!this._domain) return u`<ha-card><div class="header">Loading…</div></ha-card>`;
    if (!this._nvrId)
      return u`
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
    const i = this._config.accent_color ?? "#fc9df3", s = this._phoneScreen(), o = this._fsUpright(), r = Wt({
      month: "short",
      day: "numeric"
    }).format(new Date(A(this._domain, this._phFrac())));
    return this._renderPanel(e, t, i, r, {
      width: this._config.fs_timeline_width ?? (o ? qa : s ? 120 : 165),
      pad: this._fsPad(),
      gutter: this._fsGutter(),
      grab: this._config.fs_timeline_grab_width ?? 0,
      // 0 = the whole player
      scrim: this._config.fs_timeline_scrim ?? 0.88,
      scrimExtend: this._config.fs_timeline_scrim_extend ?? (o ? Ga : s ? 130 : 170)
    });
  }
  _closeCamSheet() {
    this._galleryOpen = !1, window.removeEventListener("pointerdown", this._outsideSheetClose, !0);
  }
  /** The camera screen: the player fills the card in its card-sized
   *  fullscreen (media-view `cardFs`) — the overlay ruler down the right, the
   *  controls along the bottom, the exit button back to the multi page — and
   *  the rest of the old timeline view comes into it as overlay chrome that
   *  shows and hides with the controls: the camera picker sliding down from a
   *  chevron at the top (`fs-top`), the events list sliding in from a chevron
   *  on the right edge and pushing the ruler left (`fs-side`; a row winds the
   *  timeline to its event), and the date pill + calendar at the foot of the
   *  ruler (the timeline's own `foot` slot).
   *  PHONE (stacked layout): the same screen scaled down, in a frame of its
   *  own (.frame) - turned 90° clockwise for landscape footage on an upright
   *  phone (laid out the card's height wide and its width tall, so it fills
   *  the card once turned: you turn the phone to watch), upright for portrait
   *  footage (see _phoneTurned). */
  _renderPanel(e, t, i, s, o) {
    const r = this._config, a = this._cameraEntries(), n = Ie(i, 0.58) || i, h = this._phoneScreen(), c = this._phoneTurned(), d = this._fsUpright(), l = r.list_text_size ?? 12, _ = r.tablet_events_grid_thumbnail_size ?? Math.round((r.tablet_events_thumbnail_size ?? 145) * 1.5), v = Math.min(this._hostWidth || 390, this._hostHeight || 844), w = h ? Math.round((v - 36) / 2) : _, T = w + (h ? 2 * $e : 2 * Xa), z = d ? Ja : h ? Za : _;
    this._eventsOpen && (this._eventsMounted = !0);
    const O = `height:${r.height || (this._isStacked() ? "100dvh" : "80vh")};--upc-accent:${i};--upc-accent-deep:${n};--upc-date-size:${r.date_font_size ?? 13}px;--upc-date-color:${r.date_font_color ?? "#ffffff"};--upc-fs-pad:${o.pad}px`, M = u`<upc-media-view
          .hass=${this.hass}
          .nvrId=${this._nvrId}
          .cameraId=${e}
          .gaps=${t}
          .targetTime=${this._targetTime}
          .scrubbing=${this._scrubbing}
          .live=${this._liveMode}
          .canTalk=${(r.talk_button ?? !0) && this._canTalk(e)}
          .stacked=${!1}
          .phone=${h}
          .upright=${d}
          .previewDir=${this._scrubDir()}
          .fastPreview=${r.scrub_fast_preview ?? "speed"}
          .accent=${i}
          .clipEndTime=${this._clipEnd}
          .now=${this._now}
          .liveAudioStart=${r.live_audio_start ?? "muted"}
          .cardFs=${!0}
          .cardFsExit=${!!this._drill || !!r.back_button}
          .cardFsClose=${!!r.fs_close_button}
          .poster=${this._panelPoster}
          .chromeHidden=${this._panelChromeHidden}
          .chromeAside=${this._calOpen && !this._calClosing}
          .holdCtrl=${this._galleryOpen || this._eventsOpen || this._calOpen}
          .fsSide=${this._eventsOpen ? T : 0}
          .fsTimeline=${!0}
          .fsTimelineWidth=${o.width}
          .fsTimelinePadding=${o.pad}
          .fsTimelineGutter=${o.gutter}
          .fsTimelineGrabWidth=${o.grab}
          .fsTimelineScrim=${o.scrim}
          .fsTimelineScrimExtend=${o.scrimExtend}
          @playback-time=${this._onPlaybackTime}
          @playback-seek=${this._onPlaybackSeek}
          @live-playing=${this._onLivePlaying}
          @go-live=${this._onLive}
          @rewind=${this._onRewind}
          @fs-exit=${this._onMediaFsExit}
          @zoom-panel=${(Y) => this._zoomPanel = Y.detail.open}
        >
          ${this._renderScrubber(
      !0,
      u`<div slot="foot" class="fs-datebox">
              <button class="date-pill fs" @click=${this._toggleCal} title="Jump to date">
                <ha-icon icon="mdi:calendar-month-outline"></ha-icon>
                <span>${s}</span>
              </button>
            </div>`
    )}
          ${a.length > 1 ? u`<div slot="fs-top" class="fs-cams ${this._galleryOpen ? "open" : ""}">
                <div class="fs-cams-body">
                  <div class="fs-cams-row" style=${`--upc-cam-tile-w:${z}px`}>
                    ${a.map((Y) => this._renderCamTile(Y, e, !0))}
                  </div>
                </div>
                <div class="fs-cams-foot">
                  <button
                    class="fs-chev fs-cams-handle"
                    title=${this._galleryOpen ? "Hide cameras" : "Cameras"}
                    @click=${this._toggleCamSheet}
                  >
                    <svg viewBox="0 0 40 14"><polyline points="4,3 20,11 36,3"></polyline></svg>
                  </button>
                </div>
              </div>` : b}
          <div
            slot="fs-side"
            class="fs-events ${this._eventsOpen ? "open" : ""} ${this._zoomPanel ? "zooming" : ""}"
            style=${`--upc-side-w:${T}px`}
          >
            <button
              class="fs-chev fs-events-handle"
              title=${this._eventsOpen ? "Hide events" : "Events"}
              @click=${this._toggleEvents}
            >
              <svg viewBox="0 0 14 40"><polyline points="11,4 3,20 11,36"></polyline></svg>
            </button>
            <div class="fs-events-body">
              ${this._eventsMounted ? u`<div class="fs-events-list">
                    <upc-event-strip
                      expanded
                      hideHead
                      captions
                      fs
                      ?gridCaptions=${!h}
                      .bands=${this._panelBands(e)}
                      .loader=${this._loader}
                      .thumbVersion=${this._thumbVersion}
                      .timeSize=${r.strip_time_size ?? 12}
                      .playingKey=${this._playingBand ? `${this._playingBand.type}@${this._playingBand.start}` : ""}
                      .expanded=${!0}
                      .gridColumns=${1}
                      .gridThumbWidth=${w}
                      .dateFontSize=${r.date_font_size ?? 13}
                      .itemTextSize=${h ? l + 1 : l}
                      .accent=${r.list_divider_color || i}
                      @strip-select=${this._onPanelEventSelected}
                    ></upc-event-strip>
                  </div>` : b}
            </div>
          </div>
        </upc-media-view>`, W = this._calOpen ? u`<div class="cal-modal"><div class="cal-scrim"></div>${this._renderCalendar(!0, !0)}</div>` : b;
    if (!h)
      return u`<ha-card class="panel" style=${O}>${M}<div class="hero"></div>${W}</ha-card>`;
    const G = this._hostWidth, H = this._hostHeight, et = c && G && H ? `width:${H}px;height:${G}px;left:${(G - H) / 2}px;top:${(H - G) / 2}px` : "";
    return u`<ha-card class="panel phone ${c ? "turned" : d ? "upright" : ""}" style=${O}>
      <div class="frame" style=${et}>${M}<div class="hero"></div>${W}</div>
    </ha-card>`;
  }
};
$.styles = ft`
    :host {
      /* custom elements default to inline — inline boxes measure width 0 in
         ResizeObserver, which would wedge layout:auto in stacked mode */
      display: block;
    }
    /* A zoom between the multi page and the camera screen (see _xf): both are
       mounted, one over the other. The page that stays sets the height; the
       other rides on top of it ('in': the camera screen over the multi page,
       which stays under; 'out': the camera screen leaving over it). The host
       holds them (layout containment: a containing block without touching
       its own position - on the phone it is pinned fixed to the screen). */
    :host([xf]) {
      contain: layout;
    }
    :host([xf='in']) ha-card.multi-wide,
    :host([xf='in']) ha-card.multi-stacked {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
    }
    /* ...and a stacking context of its own, or its overlays (a clip player's
       controls at z 6) paint over the camera screen. */
    :host([xf]) ha-card.multi-wide,
    :host([xf]) ha-card.multi-stacked {
      z-index: 0;
    }
    :host([xf='out']) ha-card.multi-wide,
    :host([xf='out']) ha-card.multi-stacked {
      position: relative;
    }
    /* The containing block of the page's fixed lightbox: its scrim covers the
       card - in a popup or a view alike - never the sidebar beside it. */
    ha-card.multi-wide {
      contain: layout;
    }
    :host([xf]) ha-card.panel {
      position: relative;
      z-index: 2;
      /* Only the player flies, not the card's own background around it. */
      background: transparent;
      box-shadow: none;
    }
    :host([xf='out']) ha-card.panel {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
    }
    .xf-dim {
      position: absolute;
      inset: 0;
      z-index: 1;
      background: #000;
      opacity: 0;
      pointer-events: none;
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
    /* Wide multi page: the header row lines up with the page below it - the
       heading over the events pane (.head-events, the pane's width), the
       grid-density control centred over the cameras (.head-cams, ending where
       the camera grid does). */
    ha-card.multi-wide .header {
      padding-top: 10px; /* a little more air above the heading */
      gap: ${fs}px;
    }
    .head-events {
      flex: 0 0 auto; /* flex-basis = the events pane's width (inline) */
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .head-cams {
      flex: 1 1 auto;
      align-self: stretch; /* the title's line: the control centres on it */
      position: relative;
      margin-right: ${qt - 12}px; /* 12 = the card padding above */
    }
    /* Segmented control: rows / 2 columns. Absolutely centred so its height
       doesn't grow the header row; fades out while the cameras are away
       (events grid open, a clip playing). The active step reads white. */
    .grid-view {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: 11px;
      background: rgba(0, 0, 0, 0.5);
      transition:
        opacity 0.24s,
        visibility 0.24s;
    }
    .grid-view.hidden {
      opacity: 0;
      visibility: hidden;
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
    /* Multi page, wide layout: "Events (N) >" as the heading - ONE button that
       opens/closes the events grid, in the title's own type and colour; the
       count is set smaller in brackets so it doesn't read as part of the title.
       The chevron turns to point back while the events grid is open. */
    .head-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 0 0 0 8px; /* the title's ink starts where the list rows' text does */
      margin: 0;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit; /* a <button> doesn't inherit it - the count and icon are sized in em */
      cursor: pointer;
      outline: none; /* a tap left a focus ring round the whole heading */
      -webkit-tap-highlight-color: transparent;
    }
    /* The count is centred on the title (not on its baseline, where the smaller
       type looked dropped). */
    .head-count {
      flex: 0 0 auto;
      font-size: 0.625em;
      font-weight: 500;
      transition: opacity 0.3s ease-out;
    }
    /* Until the events are in, the count (and the chevron after it) wait,
       invisible - then fade in together, so nothing reads "(0)" first. */
    .head-count.pending,
    .head-chev.pending {
      opacity: 0;
    }
    .head-chev {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      height: 1em; /* the 1.15em icon overflows it rather than growing the header row */
      transition: opacity 0.3s ease-out;
    }
    .head-chev ha-icon {
      --mdc-icon-size: 1.15em;
      display: block;
      transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .head-chev.open ha-icon {
      transform: rotate(180deg);
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
    /* The days: a grid of their own under the weekdays, so a month change
       slides them (and the title) alone - see _calShift, whose leaving copies
       are .cal-ghost. */
    .cal-days {
      margin-top: 4px;
    }
    .cal-ghost {
      position: absolute;
      margin: 0;
      pointer-events: none;
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
    /* ---- Wide layout: the camera screen IS the player (see _renderPanel).
       Everything below is slotted into the media view, which places it. ---- */
    ha-card.panel {
      position: relative; /* the .hero layer's box */
      padding: 0;
      overflow: hidden; /* the card's corners clip the picture and the panels */
      transition: background-color 0.24s ease-out;
    }
    /* Pictures in flight (a camera picked in the picker flying into the
       screen): over everything in the camera screen, taking no taps. */
    ha-card.panel .hero {
      position: absolute;
      inset: 0;
      z-index: 10;
      pointer-events: none;
    }
    ha-card.panel .hero > .ghost {
      position: absolute;
      object-fit: cover;
    }
    ha-card.panel upc-media-view {
      flex: 1 1 auto;
      min-height: 0;
    }
    /* The phone's camera screen: edge to edge, in a frame of its own (what a
       zoom flies) - turned sideways about its centre for landscape footage,
       the frame laid out the other way round (inline size) so it fills the
       card once turned. */
    ha-card.panel.phone {
      border-radius: 0;
    }
    ha-card.panel.phone > .frame {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
    }
    ha-card.panel.phone.turned > .frame {
      inset: auto;
      transform: rotate(90deg);
      transform-origin: 50% 50%;
    }
    /* The frame's left edge the system covers (media-view centres the play
       controls right of it): the side cutout held in landscape - and turned
       sideways, the screen's TOP, the status bar and camera cutout (user,
       2026-10-31: skip-back sat under it on an iPhone; the simulator has no
       inset). */
    ha-card.panel.phone {
      --upc-fs-left: env(safe-area-inset-left, 0px);
    }
    ha-card.panel.phone.turned {
      --upc-fs-left: env(safe-area-inset-top, 0px);
    }
    /* Its chrome, sized for a phone: the picker's tiles and names, the
       chevrons, the events column's margins. */
    ha-card.panel.phone .fs-cams {
      transform: translateY(calc(-100% + 40px));
    }
    ha-card.panel.phone .fs-cams.open {
      transform: none;
    }
    ha-card.panel.phone .fs-cams-body {
      padding: 12px 12px 2px;
    }
    ha-card.panel.phone .fs-cams-foot {
      height: 40px;
    }
    /* Open, it covers the top of the ruler: the rest of the screen dims
       under it, like under the calendar - the sheet is over everything, not
       on top of some of it. */
    ha-card.panel.phone .fs-cams-foot::before {
      height: 200vmax;
      background: linear-gradient(to bottom, rgba(0, 0, 0, 0.88), rgba(0, 0, 0, 0.55) 90px);
    }
    ha-card.panel.phone .fs-cams-row {
      gap: 12px;
    }
    ha-card.panel.phone .fs-cams .cam-name {
      font-size: 14px;
      margin-top: 4px;
    }
    ha-card.panel.phone .fs-cams .cam-tile.active {
      padding: 5px;
      border-radius: 12px;
    }
    ha-card.panel.phone .fs-cams .cam-tile.active img,
    ha-card.panel.phone .fs-cams .cam-tile.active .cam-ph {
      border-radius: 7px;
    }
    ha-card.panel.phone .fs-cams-handle {
      width: 64px;
      height: 34px;
      margin-top: 4px;
    }
    ha-card.panel.phone .fs-cams-handle svg {
      width: 32px;
      height: 12px;
    }
    ha-card.panel.phone .fs-events-handle {
      width: 32px;
      height: 64px;
      transition: opacity 0.2s ease;
    }
    /* The zoom slider opens right beside it: the chevron steps out of its
       way until it closes. */
    ha-card.panel.phone .fs-events.zooming .fs-events-handle {
      opacity: 0;
      pointer-events: none;
    }
    ha-card.panel.phone .fs-events-handle svg {
      width: 12px;
      height: 32px;
    }
    ha-card.panel.phone .fs-events-list {
      left: ${$e}px;
      right: ${$e}px;
    }
    /* Sideways, the frame's right edge is the screen's BOTTOM - iOS's
       system-gesture strip, where a button never gets the touch - so the
       events chevron keeps clear of it. */
    ha-card.panel.phone.turned .fs-events-handle {
      right: calc(100% + 10px + env(safe-area-inset-bottom, 0px));
    }
    /* Upright, the top edge is under the status bar / camera cutout: the
       picker's chevron and tiles and the events list start below it; the
       picker shows two tiles to a row. */
    ha-card.panel.phone.upright .fs-cams {
      transform: translateY(calc(-100% + 40px + env(safe-area-inset-top, 0px)));
    }
    ha-card.panel.phone.upright .fs-cams.open {
      transform: none;
    }
    ha-card.panel.phone.upright .fs-cams-body {
      padding-top: calc(12px + env(safe-area-inset-top, 0px));
    }
    ha-card.panel.phone.upright .fs-cams-row {
      flex-wrap: wrap;
      row-gap: 10px;
    }
    /* Upright the events list scrolls between the top and the control bar:
       it fades out at both ends (user, 2026-10-31: the items were cut off
       sharply there), its first and last items clear of the fades at rest -
       the first one also below the cameras chevron, which stays put. */
    ha-card.panel.phone.upright .fs-events-list {
      top: calc(var(--upc-fs-pad, 20px) + env(safe-area-inset-top, 0px));
      --upc-fs-list-pad-top: ${bt}px;
      --upc-fs-list-pad-bottom: ${bt}px;
      -webkit-mask-image: linear-gradient(
        to bottom,
        transparent,
        #000 ${bt}px,
        #000 calc(100% - ${bt}px),
        transparent
      );
      mask-image: linear-gradient(
        to bottom,
        transparent,
        #000 ${bt}px,
        #000 calc(100% - ${bt}px),
        transparent
      );
    }
    /* Sideways it scrolls on to the top of the screen (the frame's top: no
       safe area there), its first item where it was at rest. */
    ha-card.panel.phone.turned .fs-events-list {
      top: 0;
      --upc-fs-list-pad-top: var(--upc-fs-pad, 20px);
    }
    /* The date pill's calendar, compact: it opens over the pill inside a
       ~390px-tall screen (sideways) - and upright it hangs from the pill's
       right edge, which sits near the screen's. */
    ha-card.panel.phone .cal-pop.fs {
      width: 262px; /* 7 x 30px cells + 6 x 4px gaps + 2 x 14px padding */
      padding: 12px 14px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-head {
      margin-bottom: 4px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-title {
      font-size: 15px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-chev {
      width: 32px;
      height: 32px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-chev ha-icon {
      --mdc-icon-size: 22px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-cell {
      max-width: 30px;
      font-size: 14px;
    }
    ha-card.panel.phone .cal-pop.fs .cal-wk {
      height: 20px;
      font-size: 12px;
    }
    ha-card.panel.phone.upright .cal-pop.fs {
      left: auto;
      right: 0;
      translate: none;
      transform-origin: 85% 100%;
    }
    /* The camera screen's calendar (phone and tablet): in the middle of the
       screen over the picture dimmed, the player's chrome faded away (user,
       2026-10-28/30: it covered the ruler, then the tablet's play controls)
       - it flies out of the date pill and back (_calFlight). Solid: nothing
       shows through it. */
    .cal-modal {
      position: absolute;
      inset: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cal-scrim {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
    }
    ha-card.panel .cal-modal > .cal-pop.fs {
      position: relative;
      left: auto;
      right: auto;
      bottom: auto;
      translate: none;
      animation: none;
      background: rgb(28, 28, 30);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    /* Panel handles: thin, rounded UniFi/Apple-style chevrons straight on the
       footage, a soft shadow keeping them readable on any picture. Each turns
       to point back while its panel is open. */
    .fs-chev {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
      border: none;
      background: transparent;
      color: #fff;
      cursor: pointer;
      pointer-events: auto;
      outline: none;
      isolation: isolate; /* its shade (::before) stays behind its glyph */
      -webkit-tap-highlight-color: transparent;
    }
    /* A soft dark shade behind each chevron, so it reads on bright footage
       too (user, 2026-10-31) - the same kind of radial shade the play
       controls sit on; no blur. */
    .fs-chev::before {
      content: '';
      position: absolute;
      inset: -12px;
      z-index: -1;
      border-radius: 50%;
      background: radial-gradient(closest-side, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.32) 55%, transparent);
      pointer-events: none;
    }
    .fs-chev svg {
      display: block;
      fill: none;
      stroke: currentColor;
      stroke-width: 3.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.85));
      transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    /* Camera picker: a sheet sliding down from the top edge. Closed, only its
       foot — the chevron, top middle — is on screen. Same shadow as the
       timeline strip, falling from the top: solid under the tiles, fading out
       below them. The active camera reads in the overlay's deep accent. */
    .fs-cams {
      display: flex;
      flex-direction: column;
      transform: translateY(calc(-100% + 46px)); /* the foot's height */
      transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .fs-cams.open {
      transform: none;
    }
    .fs-cams-body {
      padding: 18px 16px 4px;
      background: rgba(0, 0, 0, 0.88);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: auto;
    }
    .fs-cams-foot {
      position: relative;
      display: flex;
      justify-content: center;
      height: 46px;
    }
    .fs-cams-foot::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 90px;
      background: linear-gradient(to bottom, rgba(0, 0, 0, 0.88), transparent);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    .fs-cams.open .fs-cams-body,
    .fs-cams.open .fs-cams-foot::before {
      opacity: 1;
    }
    .fs-cams-row {
      display: flex;
      gap: 14px;
      justify-content: safe center;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .fs-cams-row::-webkit-scrollbar {
      display: none;
    }
    /* Read across the room: bigger names, and a heavier frame on the active
       camera than the timeline view's 5px. */
    .fs-cams .cam-name {
      font-size: 18px;
      margin-top: 6px;
    }
    .fs-cams .cam-tile.active {
      background: var(--upc-accent-deep, rgb(106, 66, 102));
      padding: 9px;
      border-radius: 16px;
    }
    .fs-cams .cam-tile.active img,
    .fs-cams .cam-tile.active .cam-ph {
      border-radius: 8px; /* concentric inside the 16px frame */
    }
    .fs-cams .cam-tile.active .cam-name {
      color: #fff;
      margin-top: 6px;
    }
    .fs-cams-handle {
      position: relative; /* above the foot's shadow */
      width: 88px;
      height: 40px;
      margin-top: 6px; /* clear of the top edge */
    }
    .fs-cams-handle svg {
      width: 40px;
      height: 14px;
    }
    .fs-cams.open .fs-cams-handle svg {
      transform: rotate(180deg);
    }
    /* Events: a panel sliding in from the right edge while the strip and the
       controls make way (media-view fsSide). Closed, only its handle — hung off
       its left edge — is on screen, at the middle of the right edge. The
       strip's shadow carries on left of it, so the two read as one. */
    .fs-events {
      position: relative;
      width: var(--upc-side-w, 337px);
      height: 100%;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .fs-events.open {
      transform: none;
    }
    .fs-events-body {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.88);
      pointer-events: auto;
    }
    .fs-events-list {
      position: absolute; /* the events (upc-event-strip) fill it */
      top: var(--upc-fs-pad, 60px); /* starts level with the ruler */
      bottom: 0;
      left: 12px;
      right: 12px;
    }
    .fs-events-list > upc-event-strip {
      height: 100%;
    }
    .fs-events-handle {
      position: absolute;
      right: calc(100% + 10px); /* clear of the right edge (or the open panel) */
      top: 50%;
      width: 40px;
      height: 88px;
      transform: translateY(-50%);
    }
    .fs-events-handle svg {
      width: 14px;
      height: 40px;
    }
    .fs-events.open .fs-events-handle svg {
      transform: rotate(180deg);
    }
    /* Date pill at the foot of the overlay ruler (the timeline's foot slot:
       level with the jump-to-live arrow, centred under the playhead pill) —
       the timeline view's pill in the overlay's colours. Its calendar opens
       upward, centred over it. */
    .fs-datebox {
      position: relative;
    }
    .date-pill.fs {
      position: relative;
      left: auto;
      bottom: auto;
      color: #fff;
      background: var(--upc-accent-deep, rgba(0, 0, 0, 0.6));
      white-space: nowrap;
      outline: none;
    }
    .cal-pop.fs {
      left: 50%;
      right: auto;
      translate: -50% 0; /* (not transform: the pop-in animates scale) */
      bottom: calc(100% + 12px);
      width: 366px; /* 7×44px cells + 6×4px gaps + 2×16px padding */
      background: rgba(0, 0, 0, 0.82);
      -webkit-backdrop-filter: blur(8px);
      backdrop-filter: blur(8px);
      /* Pops out of the date pill under it, iOS-menu style (and shrinks back
         into it - _closeCal). */
      transform-origin: 50% 100%;
      animation: upc-cal-in 0.34s cubic-bezier(0.25, 0.8, 0.3, 1);
    }
    @keyframes upc-cal-in {
      from {
        opacity: 0;
        scale: 0.9;
      }
    }
    .cal-pop.fs .cal-day.sel {
      color: #000; /* on the bright accent */
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
E([
  p({ attribute: !1 })
], $.prototype, "hass", 2);
E([
  m()
], $.prototype, "_config", 2);
E([
  m()
], $.prototype, "_domain", 2);
E([
  m()
], $.prototype, "_gaps", 2);
E([
  m()
], $.prototype, "_targetTime", 2);
E([
  m()
], $.prototype, "_scrubbing", 2);
E([
  m()
], $.prototype, "_liveMode", 2);
E([
  m()
], $.prototype, "_livePaused", 2);
E([
  m()
], $.prototype, "_now", 2);
E([
  m()
], $.prototype, "_nvrId", 2);
E([
  m()
], $.prototype, "_mode", 2);
E([
  m()
], $.prototype, "_activeCamera", 2);
E([
  m()
], $.prototype, "_drill", 2);
E([
  m()
], $.prototype, "_xf", 2);
E([
  m()
], $.prototype, "_panelPoster", 2);
E([
  m()
], $.prototype, "_panelChromeHidden", 2);
E([
  m()
], $.prototype, "_galleryOpen", 2);
E([
  m()
], $.prototype, "_eventsOpen", 2);
E([
  m()
], $.prototype, "_calOpen", 2);
E([
  m()
], $.prototype, "_zoomPanel", 2);
E([
  m()
], $.prototype, "_calCursor", 2);
E([
  m()
], $.prototype, "_hostWidth", 2);
E([
  m()
], $.prototype, "_hostHeight", 2);
E([
  m()
], $.prototype, "_thumbVersion", 2);
E([
  m()
], $.prototype, "_playingBand", 2);
E([
  m()
], $.prototype, "_clipEnd", 2);
E([
  m()
], $.prototype, "_manifestBands", 2);
E([
  m()
], $.prototype, "_multiHead", 2);
E([
  js("upc-scrubber-timeline")
], $.prototype, "_timelines", 2);
E([
  m()
], $.prototype, "_calClosing", 2);
$ = E([
  mt("unifi-protect-timeline-card")
], $);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "unifi-protect-timeline-card",
  name: "UniFi Protect Timeline",
  description: "UniFi Protect-style touch scrubber for camera footage and detections",
  preview: !1
});
console.info(
  `%c UNIFI-PROTECT-TIMELINE-CARD %c v${en} `,
  "color:#fff;background:#03a9f4;font-weight:700;border-radius:3px 0 0 3px;padding:2px 4px",
  "color:#03a9f4;background:#222;border-radius:0 3px 3px 0;padding:2px 4px"
);
export {
  $ as UnifiProtectTimelineCard
};

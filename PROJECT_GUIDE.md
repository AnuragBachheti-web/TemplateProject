# Action Stories — Engineer Guide (easy language)

> Ye project kisi aur developer ne banaya tha, tumhe assign hua hai. Ye doc padhne ke baad
> tumhe pata chal jayega: ye kya hai, data kahan se aata hai, "4-5 variation" wala matlab kya
> hai, aur kaunsi file kis kaam ke liye hai. 15 min mein pura padha ja sakta hai.

---

## 1. Ek line mein: ye project kya hai

Ye **ek hi generic screen** hai jo **26 alag-alag "workflows"** ko render karta hai
(codes: `S9.1` ... `S9.20`, `S10.1` ... `S10.6`). Har workflow ke andar 4 stages hote hain
(kabhi-kabhi 5): **Reason → Analyze → Decide → Execute** (S10.6 mein ek extra "Live" stage bhi hai).

Important baat: **koi bhi stage/screen ke liye alag React component nahi likha gaya hai.**
Ek hi renderer (`StageRenderer.jsx`) sab 26×4 (=104) screens ko render karta hai. Har screen
kaisa dikhega, ye **JSON manifest file** decide karti hai, aur data ek **alag JSON fixture file**
se aata hai. Isiliye "template kaunsi fix hai, kitna andar change hota hai" wala tumhara sawaal
bilkul sahi angle hai — niche section 3 mein exact jawab hai.

Ye abhi ek **scaffold/prototype repo** hai (fake/local JSON data ke saath) jo baad mein asli
`realifyai` app ke andar merge hoga aur real backend API se connect hoga. Merge karne ka poora
checklist `INTEGRATION.md` file mein already likha hua hai — wo mat bhoolna, wahan bahut kaam ka
context hai (especially field-name mismatches jo real API se milte waqt fix karne honge).

---

## 2. Page load hone se lekar screen dikhne tak — poora flow

```
User URL kholta hai:  /action-stories/S9.1/reason
        │
        ▼
App.jsx (router) ──> Shell.jsx  (left sidebar: sab 26 workflows ki list)
        │                  │
        │                  └─ getWorkflowIndex() call karta hai ek baar
        │                     (list banane ke liye — kaunsa code, kaunsa naam)
        ▼
   <Outlet /> ke andar ─> StagePage.jsx  (URL se `code` aur `stageKey` padhta hai)
        │
        ├─ getWorkflowIndex()  → workflow ka naam + stages list
        └─ getStageData(code, stageKey)
                │
                ├─> manifest load hota hai:  manifests/S9.1.json  (is stage ke "blocks" ki list)
                └─> fixture load hoti hai:   data/raw/S9.1/reason.json  (asli data)
        ▼
   StagePage har block ke liye:
      1. StepTracker.jsx        → upar wali "1.Reason 2.Analyze 3.Decide 4.Execute" pill strip
      2. StageRenderer.jsx      → beech ka poora content (blocks ek ke niche ek)
      3. StageActionBar.jsx     → neeche "Approve / Start" button (sirf decide/execute stage pe)
        ▼
   StageRenderer.jsx, manifest.blocks array ke har entry ke liye:
      a. resolveBinding(block.binding, fixture)   → JSON path se value nikalta hai
                                                      e.g. "data.dialNote" → fixture.data.dialNote
      b. validateBlockData(block.blockType, value) → value sahi shape mein hai ya nahi check
      c. BLOCK_REGISTRY[block.blockType]           → sahi component choose karta hai
                                                      (text / table / itemQueue / labelValueList / ...)
      d. <Component data={value} />                → asli render
```

Do cheezein yaad rakhna:

- **Koi bhi step crash nahi karta.** Agar binding galat hai, ya blockType unknown hai, ya data
  wrong shape mein hai — screen crash nahi hoti, ek chhota "placeholder" box dikhta hai aur
  console mein warning aati hai. Ye jaan-bujh kar design kiya gaya hai (dev mein loud, prod mein
  safe).
- **Zustand store** (`useActionStoriesStore.js`) sirf ek chhoti si UI state rakhta hai — "Approve
  button dabaya ya nahi". Ye kaunsa workflow/stage khula hai, ye state store mein NAHI hai — wo
  hamesha URL mein hi hota hai (`useParams()` se seedha padha jata hai). Isliye refresh/back-forward
  hamesha sahi screen dikhata hai.

---

## 3. "4-5 variation" wala jawab — kya fix hai, kya har workflow ke liye alag hai

Ye teen layers mein baant ke socho:

| Layer | Kya hai | Fix rehta hai ya badalta hai? |
|---|---|---|
| **Engine (code)** | `Shell.jsx`, `StagePage.jsx`, `StageRenderer.jsx`, `StageActionBar.jsx`, `StepTracker.jsx`, aur 9 block components (`blocks/*.jsx`) | **100% FIX.** Ye har workflow ke liye same hi chalta hai. Naya workflow add karne ke liye ye files touch NAHI karni. |
| **Manifest (structure)** | `manifests/S9.1.json` (aur baaki 25 files) — batata hai is stage mein kaunse "slots"/blocks honge aur kaunsa blockType hai | **Har workflow/stage ke liye alag.** Ye decide karta hai screen pe kya-kya blocks dikhenge aur kaunsi shape mein (table? list? text?). |
| **Fixture (actual data)** | `data/raw/S9.1/reason.json` (aur baaki fixtures) — asli values | **Har workflow/stage ke liye alag.** Sirf numbers/strings/rows — jo screen pe dikhta hai. |

Matlab: **"template" (engine) hamesha same rehta hai**, aur "4-5 variation" (actually 26
variations × ~4-5 stages = ~104 screens) sirf do JSON files badal ke banti hain — koi naya
component nahi likhna padta.

Ek block-type ka poora vocabulary (9 types) fix hai, `manifests/blockTypes.js` mein defined:

```
text, number, flag, labelValueList, table, itemQueue, series, object, slider
```

`blocks/index.js` mein ek simple map hai: `blockType → Component`.
```js
export const BLOCK_REGISTRY = {
  text: TextBlock,
  table: TableBlock,
  itemQueue: ItemQueueBlock,
  ... // total 9
};
```
**Naya block type chahiye ho to:** ek naya component `blocks/` mein banao, `blockTypes.js` mein
uska validator likho, aur `blocks/index.js` mein ek line add karo. `StageRenderer.jsx` ko haath
lagane ki zarurat nahi — wo blindly registry lookup karta hai.

**Naya workflow/screen chahiye ho (ya kisi existing ko change karna ho):** sirf uska
`manifests/<CODE>.json` aur `data/raw/<CODE>/<stage>.json` change/add karo. Code change zero.

---

## 4. Har file/folder kya karta hai aur kyun (cheat sheet)

```
src/
├── App.jsx                     Router setup. Sab routes yahan define hain.
├── constants/
│   └── actionStoriesRoutes.js  URL banane ke helper functions (single source of truth for URLs)
├── services/
│   └── actionStoriesService.js API layer — ABHI local JSON files padhta hai (fake data).
│                                Yehi wo file hai jise real backend aane par badalna hai —
│                                sirf isi ek file mein change, baaki kuch nahi.
├── store/
│   └── useActionStoriesStore.js Zustand store — sirf "Approve/Start button dabaya ya nahi" yaad
│                                rakhta hai. Real mutation abhi nahi hai (TODO comment hai isme).
└── features/action-stories/
    ├── components/
    │   ├── Shell.jsx           Left sidebar (26 workflows ki list) + <Outlet/>. App ka "frame".
    │   ├── StageRenderer.jsx   ⭐ MAIN ENGINE. Manifest ke blocks ko fixture data se render karta hai.
    │   ├── StageActionBar.jsx  Neeche ka Approve/Start button.
    │   └── StepTracker.jsx     Upar ki Reason→Analyze→Decide→Execute pill strip.
    ├── pages/
    │   ├── ActionStoriesHome.jsx  `/action-stories` khulte hi pehle workflow ke pehle stage
    │                               pe redirect kar deta hai.
    │   └── StagePage.jsx       URL se code+stageKey padhta hai, manifest+fixture fetch karta
    │                            hai, aur Shell/StageRenderer/StageActionBar ko jodta hai.
    ├── manifests/
    │   ├── <CODE>.json (×26)   Har workflow ke liye: [{stageKey, blocks:[{slotName, blockType,
    │                            binding}]}]. "Is screen pe kya dikhega" — STRUCTURE.
    │   ├── resolveBinding.js   "data.dialNote" jaisa string path leke fixture se value nikalta hai.
    │   ├── blockTypes.js       9 block types ki definition + validator har ek ke liye.
    │   ├── validateManifest.js Manifest file khud sahi shape mein hai ya nahi, check karta hai.
    │   └── REPORT.md           Bahut detail mein likha document — kaunsa field genuinely real
    │                            data se match karta hai, kaunsa sirf guess hai. Zaroor padhna
    │                            jab backend field-mapping karni ho.
    ├── blocks/                 9 "dumb" presentational components (TextBlock, TableBlock,
    │                            ItemQueueBlock, LabelValueListBlock, NumberBlock, FlagBlock,
    │                            SeriesBlock, ObjectBlock, SliderBlock) — sirf render karte hain,
    │                            koi API call nahi karte. Har ek `{ slotName, data }` leta hai.
    └── data/
        ├── index.json          Sab 26 workflows ki list: {code, name, stages: [...]}
        └── raw/<CODE>/<stage>.json (×104)   Actual "API response" jaisa data — abhi local file.
```

Extra (build-time, app ka part NAHI hai — `extraction/` folder):
ye ek one-time tool hai jo `source-mockups/*.dc.html` (designer ki mockup files) se
`manifests/*.json` aur `data/raw/**/*.json` generate karta hai. Roz ke kaam mein isko touch
karne ki zarurat nahi padegi, sirf tab jab naye mockups aayen. `npm run extract` se chalta hai.

---

## 5. Data abhi kahan se aa raha hai (aur real API aane par kya badlega)

Abhi `actionStoriesService.js` file **local JSON files** ko `import.meta.glob(...)` se load
karti hai — koi network call nahi ho raha. Ye file khud comment mein likhti hai:

```js
// SAMPLE DATA — reads local fixtures; swap the body of these two functions for real API calls
// when GET /v1/action-stories exists, nothing else should need to change.
```

Matlab: `getWorkflowIndex()` aur `getStageData(code, stageKey)` — sirf inn 2 functions ka andar
ka code badalna hoga (axios/httpClient call se), signature same rahega, to koi aur file
(`StagePage`, `Shell`, etc.) ko touch karne ki zarurat nahi. `INTEGRATION.md` mein exact "before
vs after" code diya hua hai.

⚠️ **Important gotcha (INTEGRATION.md se):** kuch field names jo abhi mockup-data mein hain
(`execution_lane`, `guardrail_verdict`) waise hi naam se real backend mein bhi hain, lekin **matlab
alag hai** — real data aane par ye galat cheez dikha sakte hain agar bina check kiye wire kar diya
jaye. Backend connect karte waqt `INTEGRATION.md` ka table zaroor dekh lena.

---

## 6. Abhi kya incomplete/decorative hai (taaki confuse na ho)

- **Approve/Start button** — sirf UI hai, koi backend save nahi hoti (refresh karoge to reset ho
  jayega). Real mutation store mein `TODO(action-stories-mutations)` comment ke saath likha hai.
- **Slider block** — abhi kisi bhi screen mein use nahi ho raha, code ready hai future ke liye.
- **`recharts` library** — installed hai but abhi use nahi ho rahi; `SeriesBlock.jsx` chart ko
  raw SVG path se dikhata hai, real chart library baad mein wire hogi.

---

## 7. Rozana kaam ke liye quick recipes

| Karna kya hai | Kahan jao |
|---|---|
| Kisi screen pe naya field dikhana hai | Uska `manifests/<CODE>.json` mein ek naya `{slotName, blockType, binding}` add karo + fixture mein wo data ho |
| Ek block ka look/style badalna hai | `blocks/<TypeName>Block.jsx` open karo — ye sabhi workflows pe apply hoga (kyunki fix hai) |
| Naya workflow/stage add karna hai | Naya `manifests/<CODE>.json` + `data/raw/<CODE>/*.json` + `data/index.json` mein entry |
| Naya block type chahiye | `blocks/NewBlock.jsx` banao → `blocks/index.js` mein register karo → `manifests/blockTypes.js` mein validator |
| Real backend se connect karna hai | Sirf `services/actionStoriesService.js` badlo (details: `INTEGRATION.md`) |
| Approve button ko real save karana hai | `store/useActionStoriesStore.js` ka TODO comment dekho |
| Kisi field ka real API meaning check karna hai | `manifests/REPORT.md` + `INTEGRATION.md` ka table |

---

**Bas itna samajh lo:** ye "104 alag screens" nahi hain — ye "1 engine + 104 chhote JSON files"
hai. Jab bhi confuse ho ki "ye value kahan se aa rahi hai", trace karne ka order hamesha same
hai: **URL → `manifests/<CODE>.json` (kaunsa block) → `binding` string → `data/raw/<CODE>/<stage>.json`
(asli value)**.

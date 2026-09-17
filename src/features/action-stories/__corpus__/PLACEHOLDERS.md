PLACEHOLDER INVENTORY — Phase 4 Part 1

GENERATED FROM provenance.json — never hand-written (R35). Regenerate with:
  node scripts/placeholderInventory.mjs > src/features/action-stories/__corpus__/PLACEHOLDERS.md

THE HANDOVER CONTRACT. Every value marked * below is INVENTED for the prototype and must be
replaced when a real API is connected. Every value NOT marked is derived from the reference
corpus and must not be changed — those 54 are pinned byte-identical by T42 against a snapshot
taken before Part 1 wrote anything (__snapshots__/reference-derived-header.json).

The machine-readable source of truth is provenance.json: a field whose recorded source reads
"(placeholder)" is invented. This file is that same fact, made readable.

TOTALS  (of 105 objects each)
  brand     invented  92   reference-derived  13
  channel   invented  91   reference-derived  14
  category  invented 104   reference-derived   1
  agent     invented  79   reference-derived  26
  impact    invented 105   reference-derived   0

VALUE SPACES — no new name was minted (R36). Brands and categories come from the corpus's own
vocabulary; channels from the contract enum; agents from a sibling stage's own `proposal.agents`.
  brand     alder, ridgeline
  category  bakeware, cookware, kitchen tools, storage
  channel   amazon, dtc, faire, google, shopify, walmart, wholesale

LEGEND  * = invented

  OBJECT                BRAND       CHANNEL     CATEGORY        AGENT                          IMPACT
  ---------------------------------------------------------------------------------------------------------

  prop_s9_1_reason      alder*      google*     cookware*       Role Classifier                214 unsigned count*
  prop_s9_1_analyze     alder*      google*     cookware*       Role Classifier*               214 unsigned count*
  prop_s9_1_decide      alder*      google*     cookware*       Role Classifier*               214 unsigned count*
  prop_s9_1_execute     alder       google*     cookware*       Role Classifier*               214 unsigned count*

  prop_s9_2_reason      ridgeline*  wholesale*  storage*        Probabilistic Forecast Engine  88000 unsigned USD*
  prop_s9_2_analyze     ridgeline*  wholesale*  storage*        Probabilistic Forecast Engine* 88000 unsigned USD*
  prop_s9_2_decide      ridgeline*  wholesale*  storage*        Probabilistic Forecast Engine* 88000 unsigned USD*
  prop_s9_2_execute     ridgeline*  wholesale   storage*        Probabilistic Forecast Engine* 88000 unsigned USD*

  prop_s9_3_reason      alder*      walmart*    kitchen tools*  Planner                        -4200 USD*
  prop_s9_3_analyze     alder*      walmart*    kitchen tools*  Planner*                       -4200 USD*
  prop_s9_3_decide      alder*      walmart*    kitchen tools*  Planner*                       -4200 USD*
  prop_s9_3_execute     alder*      walmart*    kitchen tools*  Planner*                       -4200 USD*

  prop_s9_4_reason      ridgeline*  dtc*        bakeware*       Bidder                         18000 unsigned USD*
  prop_s9_4_analyze     ridgeline   dtc*        bakeware*       Bidder*                        18000 unsigned USD*
  prop_s9_4_decide      ridgeline   dtc*        bakeware*       Bidder*                        18000 unsigned USD*
  prop_s9_4_execute     ridgeline   dtc*        bakeware*       Bidder*                        18000 unsigned USD*

  prop_s9_5_reason      ridgeline*  faire*      cookware*       Scout                          -1700 USD*
  prop_s9_5_analyze     ridgeline*  faire*      cookware*       Scout*                         -1700 USD*
  prop_s9_5_decide      ridgeline*  faire*      cookware*       Scout*                         -1700 USD*
  prop_s9_5_execute     ridgeline   faire*      cookware*       Scout*                         -1700 USD*

  prop_s9_6_reason      ridgeline*  amazon*     storage*        Merchandiser                   18 unsigned count*
  prop_s9_6_analyze     ridgeline*  amazon*     storage*        Merchandiser*                  18 unsigned count*
  prop_s9_6_decide      ridgeline   amazon*     storage*        Merchandiser*                  18 unsigned count*
  prop_s9_6_execute     ridgeline*  amazon*     storage*        Merchandiser*                  18 unsigned count*

  prop_s9_7_reason      ridgeline   shopify*    kitchen tools*  mROAS Engine                   -4300 USD*
  prop_s9_7_analyze     ridgeline   shopify*    kitchen tools*  mROAS Engine*                  -4300 USD*
  prop_s9_7_decide      ridgeline*  shopify*    kitchen tools*  mROAS Engine*                  -4300 USD*
  prop_s9_7_execute     ridgeline*  shopify*    kitchen tools*  mROAS Engine*                  -4300 USD*

  prop_s9_8_reason      ridgeline*  amazon*     bakeware*       Merchandiser                   37400 unsigned USD*
  prop_s9_8_analyze     ridgeline   amazon*     bakeware*       Merchandiser*                  37400 unsigned USD*
  prop_s9_8_decide      ridgeline*  amazon*     bakeware*       Merchandiser*                  37400 unsigned USD*
  prop_s9_8_execute     ridgeline*  amazon*     bakeware*       Merchandiser*                  37400 unsigned USD*

  prop_s9_9_reason      alder*      dtc         cookware*       Markdown Ladder Optimizer      -70100 USD*
  prop_s9_9_analyze     alder*      dtc*        cookware*       Markdown Ladder Optimizer*     -70100 USD*
  prop_s9_9_decide      alder*      amazon      cookware*       Markdown Ladder Optimizer*     -70100 USD*
  prop_s9_9_execute     alder*      dtc         cookware*       Markdown Ladder Optimizer*     -70100 USD*

  prop_s9_10_reason     ridgeline*  dtc*        cookware*       Controller                     -31200 USD*
  prop_s9_10_analyze    ridgeline   dtc*        cookware*       Controller*                    -31200 USD*
  prop_s9_10_decide     ridgeline   dtc*        cookware*       Controller*                    -31200 USD*
  prop_s9_10_execute    ridgeline*  dtc*        cookware*       Controller*                    -31200 USD*

  prop_s9_11_reason     ridgeline*  dtc*        bakeware*       Pricer                         +9700 USD*
  prop_s9_11_analyze    ridgeline*  dtc         bakeware*       Pricer*                        +9700 USD*
  prop_s9_11_decide     ridgeline*  dtc*        bakeware*       Pricer*                        +9700 USD*
  prop_s9_11_execute    ridgeline*  dtc         bakeware*       Pricer*                        +9700 USD*

  prop_s9_12_reason     alder*      amazon*     kitchen tools*  Keeper                         +21400 USD*
  prop_s9_12_analyze    alder*      amazon*     kitchen tools*  Keeper*                        +21400 USD*
  prop_s9_12_decide     alder*      amazon*     kitchen tools*  Keeper*                        +21400 USD*
  prop_s9_12_execute    alder*      amazon*     kitchen tools*  Keeper*                        +21400 USD*

  prop_s9_13_reason     ridgeline*  wholesale*  storage*        Promoter                       12 unsigned count*
  prop_s9_13_analyze    ridgeline*  wholesale*  storage*        Promoter*                      12 unsigned count*
  prop_s9_13_decide     ridgeline*  wholesale   storage*        Promoter*                      12 unsigned count*
  prop_s9_13_execute    ridgeline*  wholesale*  storage*        Promoter*                      12 unsigned count*

  prop_s9_14_reason     alder*      shopify*    cookware*       Merchandiser                   11 unsigned count*
  prop_s9_14_analyze    alder*      shopify*    cookware*       Merchandiser*                  11 unsigned count*
  prop_s9_14_decide     alder*      shopify*    cookware*       Merchandiser*                  11 unsigned count*
  prop_s9_14_execute    alder*      shopify*    cookware*       Merchandiser*                  11 unsigned count*

  prop_s9_15_reason     ridgeline*  google*     bakeware*       Merchandiser                   +9900 USD*
  prop_s9_15_analyze    ridgeline*  google*     bakeware*       Merchandiser*                  +9900 USD*
  prop_s9_15_decide     ridgeline*  google*     bakeware*       Merchandiser*                  +9900 USD*
  prop_s9_15_execute    ridgeline*  google*     bakeware*       Merchandiser*                  +9900 USD*

  prop_s9_16_reason     alder*      wholesale*  kitchen tools*  Prospector                     92500 unsigned USD*
  prop_s9_16_analyze    alder*      wholesale*  kitchen tools*  Prospector*                    92500 unsigned USD*
  prop_s9_16_decide     alder*      wholesale*  kitchen tools*  Prospector*                    92500 unsigned USD*
  prop_s9_16_execute    alder*      wholesale*  kitchen tools*  Prospector*                    92500 unsigned USD*

  prop_s9_17_reason     alder*      walmart*    storage*        Sourcer                        +20900 USD*
  prop_s9_17_analyze    alder*      walmart*    storage*        Sourcer*                       +20900 USD*
  prop_s9_17_decide     alder       walmart*    storage*        Sourcer*                       +20900 USD*
  prop_s9_17_execute    alder       walmart*    storage*        Sourcer*                       +20900 USD*

  prop_s9_18_reason     alder*      shopify     cookware*       Node Optimizer                 +0.62 USD*
  prop_s9_18_analyze    alder*      shopify*    cookware*       Node Optimizer*                +0.62 USD*
  prop_s9_18_decide     alder*      shopify*    cookware*       Node Optimizer*                +0.62 USD*
  prop_s9_18_execute    alder*      shopify*    cookware*       Node Optimizer*                +0.62 USD*

  prop_s9_19_reason     ridgeline*  amazon      bakeware*       Incrementality Engine          240000 unsigned USD*
  prop_s9_19_analyze    ridgeline*  amazon*     bakeware*       Incrementality Engine*         240000 unsigned USD*
  prop_s9_19_decide     ridgeline*  amazon*     bakeware*       Incrementality Engine*         240000 unsigned USD*
  prop_s9_19_execute    ridgeline*  amazon*     bakeware*       Incrementality Engine*         240000 unsigned USD*

  prop_s9_20_reason     ridgeline*  wholesale*  cookware*       Trend Affinity Engine          9400 unsigned USD*
  prop_s9_20_analyze    ridgeline*  wholesale*  cookware        Trend Affinity Engine*         9400 unsigned USD*
  prop_s9_20_decide     ridgeline*  wholesale*  cookware*       Trend Affinity Engine*         9400 unsigned USD*
  prop_s9_20_execute    ridgeline*  wholesale*  cookware*       Trend Affinity Engine*         9400 unsigned USD*

  prop_s10_1_reason     alder*      amazon*     kitchen tools*  Steward                        -1840 USD*
  prop_s10_1_analyze    alder*      amazon      kitchen tools*  Steward*                       -1840 USD*
  prop_s10_1_decide     alder*      amazon*     kitchen tools*  Steward*                       -1840 USD*
  prop_s10_1_execute    alder*      amazon*     kitchen tools*  Steward*                       -1840 USD*

  prop_s10_2_reason     ridgeline*  faire*      bakeware*       Cash Ladder Engine             -31000 USD*
  prop_s10_2_analyze    ridgeline*  faire*      bakeware*       Cash Ladder Engine*            -31000 USD*
  prop_s10_2_decide     ridgeline*  faire*      bakeware*       Cash Ladder Engine*            -31000 USD*
  prop_s10_2_execute    ridgeline*  faire*      bakeware*       Cash Ladder Engine*            -31000 USD*

  prop_s10_3_reason     alder*      amazon*     cookware*       Health Score Monitor           -3.4 pct*
  prop_s10_3_analyze    alder*      amazon*     cookware*       Health Score Monitor*          -3.4 pct*
  prop_s10_3_decide     alder*      amazon*     cookware*       Health Score Monitor*          -3.4 pct*
  prop_s10_3_execute    alder*      amazon*     cookware*       Health Score Monitor*          -3.4 pct*

  prop_s10_4_reason     ridgeline*  amazon      storage*        Fee Reconciliation Engine      +4120 USD*
  prop_s10_4_analyze    ridgeline*  amazon*     storage*        Fee Reconciliation Engine*     +4120 USD*
  prop_s10_4_decide     ridgeline*  amazon*     storage*        Fee Reconciliation Engine*     +4120 USD*
  prop_s10_4_execute    ridgeline*  amazon*     storage*        Fee Reconciliation Engine*     +4120 USD*

  prop_s10_5_reason     alder*      amazon      kitchen tools*  Sync Integrity Monitor         640 unsigned USD*
  prop_s10_5_analyze    alder*      amazon      kitchen tools*  Sync Integrity Monitor*        640 unsigned USD*
  prop_s10_5_decide     alder*      amazon      kitchen tools*  Sync Integrity Monitor*        640 unsigned USD*
  prop_s10_5_execute    alder*      amazon*     kitchen tools*  Sync Integrity Monitor*        640 unsigned USD*

  prop_s10_6_reason     ridgeline*  google*     bakeware*       Event Forecast Model           3100 unsigned USD*
  prop_s10_6_analyze    ridgeline*  google*     bakeware*       Event Forecast Model*          3100 unsigned USD*
  prop_s10_6_decide     ridgeline*  google*     bakeware*       Event Forecast Model*          3100 unsigned USD*
  prop_s10_6_execute    ridgeline*  google*     bakeware*       Event Forecast Model*          3100 unsigned USD*
  prop_s10_6_live       ridgeline*  google*     bakeware*       Event Forecast Model*          3100 unsigned USD*

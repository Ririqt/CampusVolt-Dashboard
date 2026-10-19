/**
 * CampusVolt - Internationalization (i18n) Module
 * Supports dynamic switching between English and Filipino (Tagalog)
 * with instant DOM updates and persistent preference storage.
 */

export const TRANSLATIONS = {
  en: {
    // Navigation
    nav_dashboard: "Dashboard",
    nav_information: "Information",
    nav_settings: "Settings",
    nav_team: "The Team",
    nav_live: "Live • CampusVolt-AP",

    // Dashboard
    dash_title: "Choose a charging port",
    dash_subtitle_prefix: "Tap an available port to start charging · ",
    dash_price_rate: "₱1 per minute",
    dash_subbar_label: "Charging ports",
    dash_subbar_note: "Power is balanced automatically, nothing for you to set!",
    cat_outlets: "Outlets",
    cat_dc_cables: "DC cables",
    cat_wireless: "Wireless",
    status_available: "Available",
    status_in_use: "In use",

    // Modal Steps Header
    step_pay: "Pay",
    step_confirm: "Confirm",
    step_connect: "Connect",
    step_charging: "Charging",

    // Modal - Select Payment Method
    modal_choose_pay: "Choose how you'd like to pay. Charging costs",
    modal_rate_notice: "₱1 per minute.",
    modal_duration_price_title: "Select charging duration & price (linear slider):",
    modal_presets_label: "Quick presets:",
    modal_cash_title: "Cash",
    modal_cash_sub: "Insert coins",
    modal_gcash_title: "GCash",
    modal_gcash_sub: "Scan a QR code",
    modal_footer_caption: "₱1 = 1 minute of charging. No account needed.",

    // Modal - Cash Flow
    btn_back: "‹ Back",
    cash_insert_title: "Insert coins",
    cash_insert_desc: "Drop coins into the coin slot. Total minutes updates as you go.",
    cash_total_label: "Total Inserted",
    cash_mins_suffix: "minutes of charging",
    cash_proceed_btn: "Confirm & Proceed ›",

    // Modal - GCash Flow
    gcash_qr_title: "Scan QR code",
    gcash_qr_desc: "Select charging duration and scan with GCash or Maya.",
    gcash_total_label: "Total Amount",
    gcash_proceed_btn: "Confirm Payment & Proceed ›",

    // Modal - Confirm Step
    confirm_title: "Confirm Session Details",
    confirm_desc: "Please review your port and charging duration before connecting.",
    confirm_port_label: "Selected Port",
    confirm_method_label: "Payment Method",
    confirm_duration_label: "Allocated Duration",
    confirm_total_label: "Amount Paid",
    confirm_proceed_btn: "Proceed to Connect ›",

    // Modal - Connect Step
    connect_title: "Connect your device",
    connect_desc: "Plug your cable or place your device onto the designated charging port.",
    connect_btn: "I've Connected My Device ›",

    // Modal - Active Charging (Screenshot 3)
    active_time_remaining: "time remaining",
    active_device_detected: "DEVICE DETECTED",
    active_power_draw: "POWER DRAW",
    active_paid: "PAID",
    active_port: "PORT",
    active_btn_done: "Done",
    active_footer_caption: "Your session ends when the timer reaches zero.",

    // Settings
    settings_eyebrow: "Kiosk preferences",
    settings_title: "Settings",
    settings_subtitle: "These apply to this station's public display only.",
    group_display: "Display & accessibility",
    row_brightness: "Screen brightness",
    row_brightness_desc: "Adjusts for daylight or evening use",
    font_size_title: "Text size",
    font_size_desc: "Adjust font size across the kiosk in linear format",
    row_language: "Language",
    row_language_desc: "Display language for this station",
    group_sound: "Sound & alerts",
    row_sound: "Confirmation sound",
    row_sound_desc: "Plays a short tone when charging starts",
    row_low_battery: "Low battery alert",
    row_low_battery_desc: "Shows a banner when bank drops below 20%",
    group_connectivity: "Connectivity",
    row_hotspot_desc: "Local hotspot, signal strength: strong",
    row_cloud_sync: "Cloud sync",
    row_cloud_sync_desc: "Last synced with campus dashboard 2 min ago",
    group_support: "Support",
    row_report: "Report an issue",
    row_report_desc: "Flag a port, panel, or display problem to CEA staff",
    row_about: "About this station",
    row_about_desc: "Unit: CEA-01 · Firmware v1.4",
    btn_reconnect: "Reconnect",
    btn_report: "Report",
    btn_view: "View",

    // The Team
    team_eyebrow: "The Team",
    team_title_main: "Four engineers.",
    team_title_teal: "One very",
    team_title_amber: "sunny idea.",
    team_subtitle: "We're computer engineering students at the Polytechnic University of the Philippines who got tired of hunting for a working outlet, so we built a kiosk that charges on sunlight.",
    stat_members: "Team members",
    stat_school: "PUP, Sta. Mesa",
    stat_ports: "Charging points built",
    stat_thesis: "Thesis year",
    team_how_title: "How we got here",
    ms_problem_title: "Spotted the problem",
    ms_problem_desc: "Long outlet queues and brownouts on campus.",
    ms_design_title: "Designed the system",
    ms_design_desc: "Solar, storage, and nine charging points.",
    ms_built_title: "Built the kiosk",
    ms_built_desc: "Hardware, firmware, and dashboard together.",
    ms_test_title: "Put it to the test",
    ms_test_desc: "Field testing at PUP College of Engineering.",
    cta_title: "Want to know more about CampusVolt?",
    cta_subtitle: "Questions, feedback, or collaboration — we'd love to hear from you.",
    cta_btn: "Say hello",
  },

  fil: {
    // Navigation
    nav_dashboard: "Dashboard",
    nav_information: "Impormasyon",
    nav_settings: "Mga Setting",
    nav_team: "Ang Koponan",
    nav_live: "Live • CampusVolt-AP",

    // Dashboard
    dash_title: "Pumili ng charging port",
    dash_subtitle_prefix: "Pindutin ang available na port para mag-charge · ",
    dash_price_rate: "₱1 kada minuto",
    dash_subbar_label: "Mga charging port",
    dash_subbar_note: "Awtomatikong binabalanse ang kuryente, walang kailangang ayusin!",
    cat_outlets: "Mga Outlet",
    cat_dc_cables: "Mga kable ng DC",
    cat_wireless: "Wireless",
    status_available: "Puwede",
    status_in_use: "Ginagamit",

    // Modal Steps Header
    step_pay: "Bayad",
    step_confirm: "Kumpirma",
    step_connect: "Ikabit",
    step_charging: "Nagcha-charge",

    // Modal - Select Payment Method
    modal_choose_pay: "Piliin kung paano magbayad. Ang bayad ay",
    modal_rate_notice: "₱1 kada minuto.",
    modal_duration_price_title: "Piliin ang tagal at halaga ng pag-charge (linear slider):",
    modal_presets_label: "Mabilisang pagpili:",
    modal_cash_title: "Cash",
    modal_cash_sub: "Maghulog ng barya",
    modal_gcash_title: "GCash",
    modal_gcash_sub: "I-scan ang QR code",
    modal_footer_caption: "₱1 = 1 minuto ng pag-charge. Walang account na kailangan.",

    // Modal - Cash Flow
    btn_back: "‹ Bumalik",
    cash_insert_title: "Maghulog ng barya",
    cash_insert_desc: "Ihulog ang barya sa coin slot. Awtomatikong madaragdagan ang oras mo.",
    cash_total_label: "Kabuuang Naihulog",
    cash_mins_suffix: "minuto ng pag-charge",
    cash_proceed_btn: "Kumpirmahin at Magpatuloy ›",

    // Modal - GCash Flow
    gcash_qr_title: "I-scan ang QR code",
    gcash_qr_desc: "Piliin ang tagal ng pag-charge at i-scan gamit ang GCash o Maya.",
    gcash_total_label: "Kabuuang Halaga",
    gcash_proceed_btn: "Kumpirmahin ang Bayad at Magpatuloy ›",

    // Modal - Confirm Step
    confirm_title: "Kumpirmahin ang Detalye",
    confirm_desc: "Pakisuri ang napiling port at oras bago ikabit ang device.",
    confirm_port_label: "Napiling Port",
    confirm_method_label: "Paraan ng Pagbayad",
    confirm_duration_label: "Oras ng Pag-charge",
    confirm_total_label: "Kabuuang Halaga",
    confirm_proceed_btn: "Magpatuloy sa Pagkabit ›",

    // Modal - Connect Step
    connect_title: "Ikabit ang iyong device",
    connect_desc: "Isaksak ang kable o ilapag ang device sa itinalagang charging port.",
    connect_btn: "Naisaksak Ko Na ang Device ›",

    // Modal - Active Charging (Screenshot 3)
    active_time_remaining: "natitirang oras",
    active_device_detected: "NA-DETECT NA DEVICE",
    active_power_draw: "KONSUMO NG KURYENTE",
    active_paid: "BINAYAD",
    active_port: "PORT",
    active_btn_done: "Tapos na",
    active_footer_caption: "Matatapos ang iyong sesyon kapag umabot sa zero ang timer.",

    // Settings
    settings_eyebrow: "Mga kagustuhan sa kiosk",
    settings_title: "Mga Setting",
    settings_subtitle: "Nalalapat lamang ito sa pampublikong display ng istasyong ito.",
    group_display: "Display at accessibility",
    row_brightness: "Liwanag ng screen",
    row_brightness_desc: "Iniaakma para sa araw o gabi",
    font_size_title: "Laki ng teksto",
    font_size_desc: "Ayusin ang laki ng font sa buong kiosk sa linear na format",
    row_language: "Wika",
    row_language_desc: "Wika sa display ng istasyong ito",
    group_sound: "Tunog at mga alerto",
    row_sound: "Tunog ng kumpirmasyon",
    row_sound_desc: "Tumutunog kapag nagsimula ang pag-charge",
    row_low_battery: "Babala sa mahinang baterya",
    row_low_battery_desc: "Nagpapakita ng babala kapag bumaba sa 20% ang baterya",
    group_connectivity: "Koneksyon",
    row_hotspot_desc: "Lokal na hotspot, malakas ang signal",
    row_cloud_sync: "Cloud sync",
    row_cloud_sync_desc: "Huling na-sync sa dashboard 2 minuto ang nakalipas",
    group_support: "Suporta",
    row_report: "Mag-ulat ng problema",
    row_report_desc: "Ipaalam ang problema sa port, panel, o display sa mga tauhan ng CEA",
    row_about: "Tungkol sa istasyong ito",
    row_about_desc: "Yunit: CEA-01 · Firmware v1.4",
    btn_reconnect: "Kumonekta muli",
    btn_report: "I-ulat",
    btn_view: "Tingnan",

    // The Team
    team_eyebrow: "Ang Koponan",
    team_title_main: "Apat na inhinyero.",
    team_title_teal: "Isang napakagandang",
    team_title_amber: "ideya sa ilalim ng araw.",
    team_subtitle: "Mga mag-aaral kami ng Computer Engineering sa Politeknikong Unibersidad ng Pilipinas na nagsawa sa paghahanap ng saksakan sa campus, kaya binuo namin ang kiosk na ito na tumatakbo sa liwanag ng araw.",
    stat_members: "Mga miyembro",
    stat_school: "PUP, Sta. Mesa",
    stat_ports: "Charging points na gawa",
    stat_thesis: "Taon ng thesis",
    team_how_title: "Paano namin ito narating",
    ms_problem_title: "Natukoy ang problema",
    ms_problem_desc: "Mahabang pila sa saksakan at brownout sa campus.",
    ms_design_title: "Dinesenyo ang sistema",
    ms_design_desc: "Solar, imbakan ng baterya, at anim na charging points.",
    ms_built_title: "Binuo ang kiosk",
    ms_built_desc: "Pinagsama ang hardware, firmware, at dashboard.",
    ms_test_title: "Sinubukan sa aktwal",
    ms_test_desc: "Pagsubok sa PUP College of Engineering.",
    cta_title: "Nais mo bang malaman ang higit pa tungkol sa CampusVolt?",
    cta_subtitle: "Mga tanong, puna, o pakikipagtulungan — nais naming marinig mula sa iyo.",
    cta_btn: "Batiin kami",
  }
};

class I18nManager extends EventTarget {
  constructor() {
    super();
    this.currentLang = localStorage.getItem("cv_language") || "en";
  }

  getLanguage() {
    return this.currentLang;
  }

  setLanguage(lang) {
    if (lang !== "en" && lang !== "fil") lang = "en";
    this.currentLang = lang;
    localStorage.setItem("cv_language", lang);
    this.applyToDOM();
    this.dispatchEvent(new CustomEvent("language-changed", { detail: { lang } }));
  }

  t(key) {
    const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS.en;
    return dict[key] !== undefined ? dict[key] : (TRANSLATIONS.en[key] || key);
  }

  applyToDOM() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const translation = this.t(key);
      if (translation) {
        if (el.tagName === "INPUT" && (el.type === "button" || el.type === "submit")) {
          el.value = translation;
        } else {
          el.textContent = translation;
        }
      }
    });

    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      const key = el.getAttribute("data-i18n-html");
      const translation = this.t(key);
      if (translation) {
        el.innerHTML = translation;
      }
    });

    // Update html lang attribute
    document.documentElement.lang = this.currentLang === "fil" ? "tl" : "en";
  }
}

export const i18n = new I18nManager();

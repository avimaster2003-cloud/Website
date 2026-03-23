// --- APEX CHAT WIDGET (Self-Contained) ---
// Simply add this to any page: document.body.appendChild(ApexWidget.create());

(function() {
    'use strict';

    // Read query params from the script tag that loaded this file.
    const SCRIPT_PARAMS = (function(){
        try {
            let s = document.currentScript;
            if (!s) {
                const scripts = document.getElementsByTagName('script');
                s = scripts[scripts.length - 1];
            }
            const src = s && s.src ? s.src : window.location.href;
            return new URL(src, window.location.href).searchParams;
        } catch (e) {
            return new URLSearchParams(window.location.search);
        }
    })();
    window.ApexWidget = {
        // Configuration (read overrides from script query params)
        SHOP_ID: SCRIPT_PARAMS.get('shopId') || "1019",
        PRIMARY_COLOR: SCRIPT_PARAMS.get('primaryColor') || SCRIPT_PARAMS.get('primary') || "#3B82F6",
        SECONDARY_COLOR: SCRIPT_PARAMS.get('secondaryColor') || SCRIPT_PARAMS.get('secondary') || "#1E293B",
        TEXT_COLOR: SCRIPT_PARAMS.get('textColor') || SCRIPT_PARAMS.get('text') || "#F1F5F9",
        SESSION_ID: (function() {
            try {
                const existing = window.sessionStorage.getItem('apex_widget_session_id');
                if (existing) return existing;
                const created = 'user_' + Math.random().toString(36).substr(2, 9);
                window.sessionStorage.setItem('apex_widget_session_id', created);
                return created;
            } catch (e) {
                return 'user_' + Math.random().toString(36).substr(2, 9);
            }
        })(),
        // Optional URL to fetch shop config (colors) by shop id. Can be provided
        // via script query param `configUrl` or left null to skip remote fetch.
        CONFIG_URL: SCRIPT_PARAMS.get('configUrl') || SCRIPT_PARAMS.get('config') || null,
        N8N_WEBHOOK_URL: "https://api.apexconversiongroup.com/webhook-test/APEX",

        // State
        chatIsOpen: false,
        isTyping: false,
        messageCount: 0,
        firstMessageAlertSent: false,
        loadingMessageIdx: 0,
        loadingInterval: null,
        modelCache: {},

        // Hard-cached models for popular brands to enable instant display
        HARD_CACHED_MODELS: {
            "Ford": ["F-150", "F-250", "F-350", "Escape", "Edge", "Explorer", "Expedition", "Fusion", "Mustang", "Focus", "Fiesta", "Transit"],
            "Honda": ["Accord", "Civic", "CR-V", "Pilot", "Odyssey", "HR-V", "Insight", "Ridgeline", "Fit"],
            "Toyota": ["Camry", "Corolla", "RAV4", "Highlander", "Sienna", "Tundra", "Tacoma", "4Runner", "Sequoia", "Prius", "Aqua"],
            "Chevrolet": ["Silverado", "Malibu", "Equinox", "Traverse", "Tahoe", "Suburban", "Colorado", "Spark", "Bolt", "Blazer"],
            "Dodge": ["Ram", "Charger", "Challenger", "Durango", "Journey", "Dart"],
            "BMW": ["3 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X7", "M440i", "M550i", "M760i", "i3", "i4", "iX", "i7", "Z4", "M2", "M3", "M4", "M5", "M8"],
            "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "A-Class", "GLA", "GLB", "GLC", "GLE", "GLS", "AMG"],
            "Audi": ["A3", "A4", "A6", "A8", "Q3", "Q5", "Q7", "Q8", "RS3", "RS4", "RS5", "RS6", "RS7"],
            "Tesla": ["Model S", "Model 3", "Model X", "Model Y", "Cybertruck"],
            "Jeep": ["Wrangler", "Cherokee", "Grand Cherokee", "Renegade", "Compass", "Gladiator"]
        },

        // Common makes list
        COMMON_MAKES: [
            "Acura","Alfa Romeo","Aston Martin","Audi","Bentley","BMW","Buick","Cadillac","Chevrolet","Chrysler","Dodge","FIAT","Fisker","Ford","Genesis","Geo","GMC","Honda","Hummer","Hyundai","Infiniti","Isuzu","Jaguar","Jeep","Karma","Kia","Land Rover","Lexus","Lincoln","Lotus","Maserati","Mazda","Mercedes-Benz","Mercury","Merkur","MINI","Mitsubishi","Nissan","Oldsmobile","Peugeot","Plymouth","Pontiac","Porsche","Ram","Renault","Saab","Saturn","Scion","smart","Subaru","Suzuki","Tesla","Toyota","Triumph","Volkswagen","Volvo"
        ],

        loadingMessages: [
            "Connecting to the estimator engine...",
            "Gathering parts & labor data...",
            "Cross-referencing repair patterns...",
            "Checking vehicle recall & service bulletins...",
            "Calculating estimated labor time...",
            "Searching local parts availability...",
            "Applying shop-specific rates...",
            "Verifying recommended repairs...",
            "Finalizing the estimate...",
            "Almost done — preparing your estimate..."
        ],

        // Year-specific model filtering for makes with year-dependent availability
        YEAR_SPECIFIC_MODELS: {
            "Acura": {
                "Integra Type S": { minYear: 2023 },
                "MDX Type S": { minYear: 2022 }
            },
            "Audi": {
                "Q4 e-tron": { minYear: 2022 },
                "Q4 Sportback e-tron": { minYear: 2022 },
                "e-tron GT": { minYear: 2021 }
            },
            "BMW": {
                "M8": { minYear: 2019 },
                "i4": { minYear: 2022 },
                "iX": { minYear: 2022 },
                "iX M60": { minYear: 2022 },
                "iX xDrive50": { minYear: 2022 },
                "i7": { minYear: 2023 }
            },
            "Cadillac": {
                "Lyriq": { minYear: 2023 },
                "Escalade IQ": { minYear: 2024 }
            },
            "Chevrolet": {
                "Silverado EV": { minYear: 2024 },
                "Blazer EV": { minYear: 2024 },
                "Equinox EV": { minYear: 2024 },
                "Bolt EV": { minYear: 2017, maxYear: 2023 },
                "Bolt EUV": { minYear: 2022, maxYear: 2023 }
            },
            "Dodge": {
                "Charger 6e": { minYear: 2024 },
                "Durango": { minYear: 2000, maxYear: 2023 }
            },
            "Ford": {
                "F-150 Lightning": { minYear: 2022 },
                "Mustang Mach-E": { minYear: 2021 },
                "E-Transit": { minYear: 2022 },
                "Bronco": { minYear: 2021 },
                "Bronco Sport": { minYear: 2021 }
            },
            "Genesis": {
                "Electrified G70": { minYear: 2021 },
                "Electrified G80": { minYear: 2021 },
                "Electrified GV70": { minYear: 2021 },
                "GV60": { minYear: 2023 },
                "Electrified GV80": { minYear: 2022 }
            },
            "GMC": {
                "Sierra EV": { minYear: 2024 },
                "Hummer EV": { minYear: 2021 }
            },
            "Honda": {
                "e": { minYear: 2020, maxYear: 2022 },
                "Civic Type R": { minYear: 2023 },
                "Prologue": { minYear: 2024 }
            },
            "Hyundai": {
                "Ioniq": { minYear: 2021 },
                "Ioniq 5": { minYear: 2021 },
                "Ioniq 6": { minYear: 2023 },
                "Kona Electric": { minYear: 2019 }
            },
            "Jeep": {
                "Wrangler 4xe": { minYear: 2021 },
                "Grand Cherokee 4xe": { minYear: 2021 },
                "Wagoneer": { minYear: 2022 }
            },
            "Kia": {
                "EV6": { minYear: 2021 },
                "EV9": { minYear: 2023 },
                "Niro EV": { minYear: 2019 },
                "Sportage PHEV": { minYear: 2023 }
            },
            "Lexus": {
                "RZ": { minYear: 2023 },
                "LM": { minYear: 2024 }
            },
            "Lincoln": {
                "Corsair Grand Touring": { minYear: 2020 },
                "Aviator Grand Touring": { minYear: 2020 }
            },
            "Lucid": {
                "Air": { minYear: 2021 }
            },
            "Mazda": {
                "CX-50": { minYear: 2023 }
            },
            "Mercedes-Benz": {
                "EQS": { minYear: 2021 },
                "EQE": { minYear: 2022 },
                "EQC": { minYear: 2019 },
                "AMG G 63": { minYear: 2000 },
                "EQG": { minYear: 2025 }
            },
            "Mitsubishi": {
                "Outlander PHEV": { minYear: 2018 }
            },
            "Nissan": {
                "Ariya": { minYear: 2023 },
                "Leaf": { minYear: 2010 }
            },
            "Porsche": {
                "Taycan": { minYear: 2020 }
            },
            "RAM": {
                "1500 Revolution": { minYear: 2025 }
            },
            "Rivian": {
                "R1T": { minYear: 2021 },
                "R1S": { minYear: 2021 }
            },
            "Subaru": {
                "BRZ": { minYear: 2013, maxYear: 2020 },
                "BRZ": { minYear: 2022 },
                "Solterra": { minYear: 2023 }
            },
            "Tesla": {
                "Model S": { minYear: 2012 },
                "Model 3": { minYear: 2017 },
                "Model X": { minYear: 2015 },
                "Model Y": { minYear: 2020 },
                "Cybertruck": { minYear: 2023 }
            },
            "Toyota": {
                "bZ4X": { minYear: 2023 },
                "Corolla Cross": { minYear: 2020 }
            },
            "Volkswagen": {
                "ID.4": { minYear: 2021 },
                "ID.5": { minYear: 2021 },
                "ID. Buzz": { minYear: 2024 }
            }
        },

        // DOM Elements (cached after creation)
        elements: {},

        // Create the widget
        create() {
            // Inject styles
            this.injectStyles();

            // Create container
            const container = document.createElement('div');
            container.id = 'apex-widget-container';
            container.innerHTML = this.getHTML();
            // expose theme variables via CSS custom properties on the container
            // so each embed can override colors without changing the stylesheet
            try {
                if (this.PRIMARY_COLOR) container.style.setProperty('--apex-blue', this.PRIMARY_COLOR);
                if (this.SECONDARY_COLOR) container.style.setProperty('--apex-light-blue', this.SECONDARY_COLOR);
                if (this.TEXT_COLOR) container.style.setProperty('--apex-text', this.TEXT_COLOR);
            } catch (e) {
                // ignore if setting styles fails
            }
            
            // Cache elements
            this.cacheElements(container);
            
            // Setup event listeners
            this.setupListeners();
            
            // Initialize
            this.init();
            
            return container;
        },

        injectStyles() {
            if (document.getElementById('apex-widget-styles')) return;
            
            const style = document.createElement('style');
            style.id = 'apex-widget-styles';
            style.textContent = this.getStyles();
            document.head.appendChild(style);
        },

        cacheElements(container) {
            this.elements = {
                backdrop: container.querySelector('#apex-backdrop'),
                chatButton: container.querySelector('#apex-chat-button'),
                chatWindow: container.querySelector('#apex-chat-window'),
                messagesDiv: container.querySelector('#apex-chat-messages'),
                proactiveTextDiv: container.querySelector('#apex-proactive-greeting'),
                
                yearSelect: container.querySelector('#apex-year-select'),
                makeSelect: container.querySelector('#apex-make-select'),
                modelSelect: container.querySelector('#apex-model-select'),
                
                vehicleWrap: container.querySelector('#apex-vehicle-selects'),
                contactName: container.querySelector('#apex-contact-name'),
                contactPhone: container.querySelector('#apex-contact-phone'),
                closeBtn: container.querySelector('#apex-close-btn'),
                
                inputField: container.querySelector('#apex-chat-input'),
                sendBtn: container.querySelector('#apex-send-btn'),
                imageBtn: container.querySelector('#apex-image-btn'),
                imageInput: container.querySelector('#apex-image-input'),
                imagePreviewWrapper: container.querySelector('#apex-image-preview-wrapper'),
                imagePreview: container.querySelector('#apex-image-preview'),
                imageRemoveBtn: container.querySelector('#apex-image-remove-btn'),
                imageUploadWrapper: container.querySelector('#apex-image-upload-wrapper'),
                imageDataHolder: container.querySelector('#apex-image-data-holder')
            };
        },

        setupListeners() {
            console.log('[ApexWidget] Setting up event listeners with delegation');
            const { backdrop, makeSelect, chatButton, inputField, sendBtn } = this.elements;
            const self = this;
            
            if (backdrop) {
                backdrop.addEventListener('click', (e) => {
                    if (e.target === backdrop) {
                        self.closeChat();
                    }
                });
            }

            if (chatButton) {
                chatButton.addEventListener('click', () => self.toggleChat());
            }

            const closeBtn = this.elements.closeBtn;
            if (closeBtn) {
                closeBtn.addEventListener('click', () => self.toggleChat());
            }

            if (makeSelect) {
                makeSelect.addEventListener('change', () => self.onMakeChange());
            }

            if (inputField) {
                inputField.addEventListener('keypress', (e) => self.handleKeyPress(e));
            }

            if (sendBtn) {
                sendBtn.addEventListener('click', () => self.sendMessage());
            }

            const imageBtn = this.elements.imageBtn;
            const imageInput = this.elements.imageInput;
            const imageRemoveBtn = this.elements.imageRemoveBtn;

            if (imageBtn && imageInput) {
                imageBtn.addEventListener('click', () => imageInput.click());
            }

            if (imageInput) {
                imageInput.addEventListener('change', (e) => self.handleImageUpload(e));
            }

            if (imageRemoveBtn) {
                imageRemoveBtn.addEventListener('click', () => self.removeImage());
            }
        },

        init() {
            this.restoreSessionState();
            this.appendBotMessage("Hi! I'm your Virtual Service Advisor. I can help with repair estimates, diagnostics, or answer any questions about your vehicle. What can I help you with today?", false);
            this.populateYears();
            this.populateMakes();
            // If embed only provided shopId, optionally fetch colors/config from backend
            this.loadRemoteConfigIfNeeded();
            
            // Schedule proactive greeting to disappear after 5 seconds of being visible
            const self = this;
            setTimeout(() => {
                const greetingEl = self.elements.proactiveTextDiv;
                if (greetingEl) {
                    greetingEl.style.animation = 'apex-greeting-fade-out 400ms cubic-bezier(0.22, 0.9, 0.32, 1) forwards';
                }
            }, 10000); // 5s delay + 5s visible = 10s total
        },

        getSessionStorageKey(key) {
            return `apex_widget_${this.SHOP_ID}_${key}`;
        },

        restoreSessionState() {
            try {
                this.firstMessageAlertSent = window.sessionStorage.getItem(this.getSessionStorageKey('first_message_alert_sent')) === 'true';
                this.messageCount = Number(window.sessionStorage.getItem(this.getSessionStorageKey('message_count')) || '0');
            } catch (e) {
                this.firstMessageAlertSent = false;
                this.messageCount = 0;
            }
        },

        persistSessionState() {
            try {
                window.sessionStorage.setItem(this.getSessionStorageKey('first_message_alert_sent'), String(this.firstMessageAlertSent));
                window.sessionStorage.setItem(this.getSessionStorageKey('message_count'), String(this.messageCount));
            } catch (e) {
                // Ignore storage failures.
            }
        },

        // Normalize color strings (ensure leading # and simple hex validation)
        normalizeColor(c) {
            if (!c) return null;
            c = String(c).trim();
            if (c[0] === '%') { // encoded # (%23...)
                try { c = decodeURIComponent(c); } catch (e) {}
            }
            if (c[0] !== '#') c = '#' + c;
            // simple hex check
            if (/^#[0-9A-Fa-f]{3}$/.test(c) || /^#[0-9A-Fa-f]{6}$/.test(c)) return c;
            return null;
        },

        applyThemeFromConfig(cfg) {
            if (!cfg) return;
            // accept keys: primaryColor, secondaryColor, textColor
            const primary = this.normalizeColor(cfg.primaryColor || cfg.primary || cfg.PRIMARY_COLOR || this.PRIMARY_COLOR);
            const secondary = this.normalizeColor(cfg.secondaryColor || cfg.secondary || cfg.SECONDARY_COLOR || this.SECONDARY_COLOR);
            const text = this.normalizeColor(cfg.textColor || cfg.text || cfg.TEXT_COLOR || this.TEXT_COLOR);

            if (primary) this.PRIMARY_COLOR = primary;
            if (secondary) this.SECONDARY_COLOR = secondary;
            if (text) this.TEXT_COLOR = text;

            // set CSS variables on the container if present
            const container = document.getElementById('apex-widget-container');
            if (container) {
                if (this.PRIMARY_COLOR) container.style.setProperty('--apex-blue', this.PRIMARY_COLOR);
                if (this.SECONDARY_COLOR) container.style.setProperty('--apex-light-blue', this.SECONDARY_COLOR);
                if (this.TEXT_COLOR) container.style.setProperty('--apex-text', this.TEXT_COLOR);
            }
        },

        loadRemoteConfigIfNeeded() {
            // If colors already provided via script params, nothing to do
            const hasColorFromParams = SCRIPT_PARAMS.has('primaryColor') || SCRIPT_PARAMS.has('primary') || SCRIPT_PARAMS.has('textColor') || SCRIPT_PARAMS.has('secondaryColor');
            if (hasColorFromParams) return;

            const url = this.CONFIG_URL;
            if (!url || !this.SHOP_ID) return;

            const reqUrl = url.endsWith('/') ? (url + this.SHOP_ID) : (url + '/' + this.SHOP_ID);

            fetch(reqUrl, { cache: 'no-cache' })
                .then(r => {
                    if (!r.ok) throw new Error('Fetch error ' + r.status);
                    return r.json();
                })
                .then(data => {
                    // Expect data to include color fields
                    this.applyThemeFromConfig(data || {});
                })
                .catch(err => {
                    console.warn('ApexWidget: could not load remote config', err);
                });
        },

        getHTML() {
            return `
                <div id="apex-backdrop"></div>
                <button id="apex-chat-button" aria-label="Open chat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </button>
                <div id="apex-proactive-greeting">
                    Need a quick estimate or diagnosis? Get instant AI-powered analysis.
                </div>
                <div id="apex-chat-window">
                    <div id="apex-chat-header">
                        <div id="apex-avatar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                            </svg>
                        </div>
                        <div id="apex-header-text">
                            <div id="apex-header-title">APEX Virtual Service Advisor</div>
                            <div id="apex-header-subtitle">
                                <span class="apex-status-indicator"></span>
                                <span>Online</span>
                            </div>
                            <div id="apex-header-model">Model - VETRA</div>
                        </div>
                        <span id="apex-close-btn" role="button" aria-label="Close chat">✕</span>
                    </div>
                    <div id="apex-chat-messages"></div>
                    <div class="apex-form-section" id="apex-vehicle-selects">
                        <div class="apex-form-row">
                            <input id="apex-contact-name" type="text" class="apex-input" placeholder="Your name *" required />
                        </div>
                        <div class="apex-form-row">
                            <input id="apex-contact-phone" type="tel" class="apex-input" placeholder="Phone number *" required />
                        </div>
                        <div class="apex-form-row">
                            <select id="apex-year-select" class="apex-select" aria-label="Year"></select>
                        </div>
                        <div class="apex-form-row apex-form-row-split">
                            <select id="apex-make-select" class="apex-select" aria-label="Make"></select>
                            <select id="apex-model-select" class="apex-select" aria-label="Model" disabled>
                                <option value="">Select Model</option>
                            </select>
                        </div>
                        <div class="apex-form-disclaimer">
                            By providing your number, you agree to receive lead updates via SMS. Msg & data rates may apply. Reply STOP to opt-out.
                        </div>
                    </div>
                    <div id="apex-chat-input-area">
                        <div id="apex-image-upload-wrapper">
                            <input type="file" id="apex-image-input" accept="image/*" style="display: none;">
                            <button id="apex-image-btn" aria-label="Upload image" title="Attach image">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                </svg>
                            </button>
                        </div>
                        <div id="apex-image-preview-wrapper" style="display: none;">
                            <div id="apex-image-preview"></div>
                            <button id="apex-image-remove-btn" aria-label="Remove image" title="Remove photo">✕</button>
                        </div>
                        <input type="text" id="apex-chat-input" placeholder="Describe the issue or request estimate...">
                        <button id="apex-send-btn" aria-label="Send message">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                    <div id="apex-image-data-holder" style="display: none;"></div>
                </div>
            `;
        },

        // Filter models based on year availability for specific makes
        filterModelsByYear(models, make, year) {
            if (!this.YEAR_SPECIFIC_MODELS[make]) {
                return models;
            }

            const yearSpecificRules = this.YEAR_SPECIFIC_MODELS[make];
            const yearNum = parseInt(year, 10);

            return models.filter(model => {
                // If model has no year-specific rules, include it
                if (!yearSpecificRules[model]) {
                    return true;
                }

                const rule = yearSpecificRules[model];
                const minYear = rule.minYear || 0;
                const maxYear = rule.maxYear || 9999;

                return yearNum >= minYear && yearNum <= maxYear;
            });
        },

        isModelAllowedForMake(modelName, make) {
            const name = (modelName || '').toUpperCase().trim();
            const commonBlocked = ['TRAILER', 'TRACTOR', 'MOTORCYCLE', 'BUS', 'RV', 'ATV', 'MOPED', 'SNOWMOBILE'];

            if (!name || commonBlocked.some(x => name.includes(x))) {
                return false;
            }

            if (make === 'BMW') {
                const bmwBikePatterns = [
                    /^C\s?\d{3,4}/,
                    /^F\s?\d{3,4}/,
                    /^G\s?\d{3,4}/,
                    /^K\s?\d{3,4}/,
                    /^R\s?\d{3,4}/,
                    /^S\s?\d{3,4}/,
                    /^M\s?\d{3,4}/,
                    /\bGS\b/,
                    /\bGSA\b/,
                    /\bRT\b/,
                    /\bRR\b/,
                    /\bXR\b/,
                    /MOTORRAD/
                ];

                if (bmwBikePatterns.some(pattern => pattern.test(name))) {
                    return false;
                }
            }

            if (make === 'Ford') {
                const fordBlocked = ['POLICE', 'INTERCEPTOR', 'CHASSIS', 'CUTAWAY', 'STRIPPED', 'CARGO VAN'];
                if (fordBlocked.some(x => name.includes(x))) {
                    return false;
                }
            }

            if (make === 'Mercedes-Benz') {
                if (/^L([\s-]|\d)/.test(name)) {
                    return false;
                }
            }

            return true;
        },

        // Event handlers
        onMakeChange() {
            const year = this.elements.yearSelect.value;
            const make = this.elements.makeSelect.value;

            this.elements.modelSelect.innerHTML = '<option value="">Loading...</option>';
            this.elements.modelSelect.disabled = true;

            if (!year || !make) return;

            const cacheKey = `${make}::${year}`;
            
            // Check runtime cache first
            if (this.modelCache[cacheKey]) {
                this.populateModels(this.modelCache[cacheKey]);
                return;
            }

            // Check hard cache and display immediately
            if (this.HARD_CACHED_MODELS[make]) {
                const hardCachedModels = this.HARD_CACHED_MODELS[make]
                    .filter(name => this.isModelAllowedForMake(name, make));
                const filteredByYear = this.filterModelsByYear(hardCachedModels, make, year);
                this.populateModels(filteredByYear);
            }

            const apiUrl = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${encodeURIComponent(year)}?format=json`;

            fetch(apiUrl)
                .then(r => r.json())
                .then(data => {
                    const models = data.Results
                        ? data.Results.map(r => r.Model_Name)
                            .filter(Boolean)
                            .filter(name => this.isModelAllowedForMake(name, make))
                        : [];
                    
                    // Apply year-specific filtering for make
                    const filteredModels = this.filterModelsByYear(models, make, year);
                    
                    const unique = [...new Set(filteredModels)].sort((a, b) => a.localeCompare(b));
                    this.modelCache[cacheKey] = unique;
                    this.populateModels(unique);
                })
                .catch(err => {
                    console.error('Model fetch error:', err);
                    this.elements.modelSelect.innerHTML = '<option value="">Error</option>';
                });
        },

        populateYears() {
            const current = new Date().getFullYear();
            const start = 2000;
            this.elements.yearSelect.innerHTML = '<option value="">Year</option>';
            for (let y = current + 1; y >= start; y--) {
                this.elements.yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
            }
        },

        populateMakes() {
            this.elements.makeSelect.innerHTML = '<option value="">Make</option>';
            this.COMMON_MAKES.forEach(m => {
                this.elements.makeSelect.innerHTML += `<option value="${m}">${m}</option>`;
            });
        },

        populateModels(models) {
            this.elements.modelSelect.innerHTML = '<option value="">Select Model</option>';
            if (models && models.length) {
                this.elements.modelSelect.disabled = false;
                models.forEach(m => {
                    this.elements.modelSelect.innerHTML += `<option value="${m}">${m}</option>`;
                });
            } else {
                this.elements.modelSelect.innerHTML = '<option value="">No models</option>';
            }
        },

        toggleChat() {
            if (this.chatIsOpen) {
                this.closeChat();
            } else {
                this.openChat();
            }
        },

        openChat() {
            this.chatIsOpen = true;
            this.elements.chatButton.classList.add('morphing');
            this.elements.chatWindow.classList.add('open');
            this.elements.backdrop.classList.add('visible');
            this.elements.inputField.focus();
            this.elements.proactiveTextDiv.style.opacity = '0';
            this.elements.proactiveTextDiv.style.pointerEvents = 'none';
        },

        closeChat() {
            this.chatIsOpen = false;
            this.elements.chatButton.classList.remove('morphing');
            this.elements.chatWindow.classList.remove('open');
            this.elements.backdrop.classList.remove('visible');
            this.elements.proactiveTextDiv.style.opacity = '0.95';
            this.elements.proactiveTextDiv.style.pointerEvents = 'auto';
        },

        appendBotMessage(text, typewriterEffect = true) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('apex-message', 'apex-bot-message');
            messageDiv.innerHTML = '<span class="typing-text"></span>';
            this.elements.messagesDiv.appendChild(messageDiv);

            if (typewriterEffect) {
                this.isTyping = true;
                this.typewriterText(messageDiv.querySelector('.typing-text'), text, () => {
                    this.isTyping = false;
                });
            } else {
                messageDiv.querySelector('.typing-text').textContent = text;
            }

            this.elements.messagesDiv.scrollTop = this.elements.messagesDiv.scrollHeight;
        },

        appendUserMessage(text) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('apex-message', 'apex-user-message');
            messageDiv.textContent = text;
            this.elements.messagesDiv.appendChild(messageDiv);
            this.elements.messagesDiv.scrollTop = this.elements.messagesDiv.scrollHeight;
        },

        appendTypingIndicator() {
            const typingBubble = document.createElement('div');
            typingBubble.classList.add('apex-typing-bubble');
            typingBubble.id = 'apex-typing-indicator';
            typingBubble.innerHTML = `
                <div class="apex-typing-logo">A</div>
                <div class="apex-typing-text-wrapper" id="apex-typing-text-wrapper">
                    <span class="apex-typing-text" id="apex-typing-text">${this.loadingMessages[0]}</span>
                </div>
            `;
            this.elements.messagesDiv.appendChild(typingBubble);
            this.elements.messagesDiv.scrollTop = this.elements.messagesDiv.scrollHeight;

            this.loadingMessageIdx = 0;
            const self = this;
            this.loadingInterval = setInterval(() => {
                const textWrapper = document.getElementById('apex-typing-text-wrapper');
                const textEl = document.getElementById('apex-typing-text');
                
                if (textWrapper && textEl) {
                    textWrapper.classList.add('text-fade-out');
                    
                    setTimeout(() => {
                        self.loadingMessageIdx = (self.loadingMessageIdx + 1) % self.loadingMessages.length;
                        textEl.textContent = self.loadingMessages[self.loadingMessageIdx];
                        textWrapper.classList.remove('text-fade-out');
                    }, 450);
                }
            }, 4000);
        },

        removeTypingIndicator() {
            if (this.loadingInterval) {
                clearInterval(this.loadingInterval);
                this.loadingInterval = null;
            }
            const typingBubble = document.getElementById('apex-typing-indicator');
            if (typingBubble) {
                typingBubble.remove();
            }
        },

        typewriterText(element, text, onComplete) {
            let index = 0;
            element.textContent = '';

            const type = () => {
                if (index < text.length) {
                    element.textContent += text[index];
                    index++;
                    setTimeout(type, 10.5);
                } else {
                    if (onComplete) onComplete();
                }
            };
            type();
        },

        handleKeyPress(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        },

        handleImageUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.appendBotMessage('Please upload an image file.', false);
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                this.appendBotMessage('Image size must be less than 5MB.', false);
                return;
            }

            // Read file as base64
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                this.elements.imageDataHolder.dataset.imageBase64 = base64;
                this.elements.imageDataHolder.dataset.imageType = file.type;
                
                // Show preview
                this.elements.imagePreview.style.backgroundImage = `url('${base64}')`;
                this.elements.imageUploadWrapper.style.display = 'none';
                this.elements.imagePreviewWrapper.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        },

        removeImage() {
            this.elements.imageDataHolder.dataset.imageBase64 = '';
            this.elements.imageDataHolder.dataset.imageType = '';
            this.elements.imagePreview.style.backgroundImage = '';
            this.elements.imageInput.value = '';
            this.elements.imageUploadWrapper.style.display = 'flex';
            this.elements.imagePreviewWrapper.style.display = 'none';
        },

        sendMessage() {
            const text = this.elements.inputField.value.trim();
            const name = this.elements.contactName.value.trim();
            const phone = this.elements.contactPhone.value.trim();
            
            // Validate required fields
            if (!name || !phone) {
                if (!name) {
                    this.elements.contactName.style.borderColor = '#EF4444';
                    this.elements.contactName.placeholder = 'Name is required *';
                }
                if (!phone) {
                    this.elements.contactPhone.style.borderColor = '#EF4444';
                    this.elements.contactPhone.placeholder = 'Phone number is required *';
                }
                // Reset border colors after a delay
                setTimeout(() => {
                    if (!name) {
                        this.elements.contactName.style.borderColor = '';
                        this.elements.contactName.placeholder = 'Your name *';
                    }
                    if (!phone) {
                        this.elements.contactPhone.style.borderColor = '';
                        this.elements.contactPhone.placeholder = 'Phone number *';
                    }
                }, 2000);
                return;
            }
            
            if (!text || this.isTyping) return;

            this.elements.inputField.value = '';
            this.elements.inputField.disabled = true;
            this.elements.sendBtn.disabled = true;

            this.appendUserMessage(text);
            this.appendTypingIndicator();

            this.elements.vehicleWrap.classList.add('select-hidden');

            // Get image data if available
            const imageBase64 = this.elements.imageDataHolder.dataset.imageBase64 || '';
            const imageType = this.elements.imageDataHolder.dataset.imageType || '';
            const isFirstMessage = !this.firstMessageAlertSent;
            const nextMessageNumber = this.messageCount + 1;

            const payload = {
                message: text,
                send_sms_alert: isFirstMessage,
                is_first_message: isFirstMessage,
                message_number: nextMessageNumber,
                response_mode: isFirstMessage ? 'sms_and_webhook' : 'webhook_only',
                shop_id: this.SHOP_ID,
                session_id: this.SESSION_ID,
                vehicle: {
                    year: this.elements.yearSelect.value || null,
                    make: this.elements.makeSelect.value || null,
                    model: this.elements.modelSelect.value || null
                },
                contact: {
                    name: name,
                    phone: phone
                },
                image: imageBase64 ? {
                    data: imageBase64,
                    type: imageType
                } : null
            };

            this.firstMessageAlertSent = true;
            this.messageCount = nextMessageNumber;
            this.persistSessionState();

            const self = this;
            console.log('[ApexWidget] Sending payload to n8n:', payload);
            console.log('[ApexWidget] Webhook URL:', this.N8N_WEBHOOK_URL);
            
            fetch(this.N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(response => {
                console.log('[ApexWidget] Response status:', response.status);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(data => {
                self.removeTypingIndicator();
                console.log('[ApexWidget] Response from n8n:', data);

                // Only display if there's a proper message field
                const message = data.output || data.message || data.text;
                if (message && typeof message === 'string') {
                    self.appendBotMessage(message, true);
                } else {
                    // If no proper message, show generic success
                    self.appendBotMessage("Thanks! We've received your request and will get back to you shortly.", true);
                    console.warn('[ApexWidget] Unexpected response format:', data);
                }

                // Clear image after successful send
                self.removeImage();

                self.elements.inputField.disabled = false;
                self.elements.sendBtn.disabled = false;
                self.elements.inputField.focus();
            })
            .catch(err => {
                self.removeTypingIndicator();
                self.appendBotMessage("I'm sorry, this quote needs a Master Tech right now. Please call us directly!", false);
                console.error('[ApexWidget] Webhook error:', err);
                console.error('[ApexWidget] Failed payload:', payload);
                self.elements.inputField.disabled = false;
                self.elements.sendBtn.disabled = false;
            });
        },

        getStyles() {
            return `
                #apex-widget-container * { box-sizing: border-box; }
                
                :root {
                    --apex-blue: #3B82F6;
                    --apex-dark: #0F172A;
                    --apex-card: #1E293B;
                    --apex-border: #334155;
                    --apex-text: #F1F5F9;
                    --apex-text-muted: #94A3B8;
                    --apex-shadow-closed: 0 4px 12px rgba(0,0,0,0.3);
                    --apex-shadow-open: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(59, 130, 246, 0.1);
                }

                #apex-backdrop {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0);
                    backdrop-filter: blur(0px);
                    pointer-events: none;
                    z-index: 9998;
                    transition: background 360ms cubic-bezier(0.22, 0.9, 0.32, 1), backdrop-filter 360ms cubic-bezier(0.22, 0.9, 0.32, 1);
                }

                #apex-backdrop.visible {
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(8px);
                    pointer-events: auto;
                }

                #apex-chat-button {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, var(--apex-blue) 0%, #2563EB 100%);
                    color: white;
                    border-radius: 50%;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 9999;
                    box-shadow: var(--apex-shadow-closed), 0 0 0 0 rgba(59, 130, 246, 0.4);
                    transition: box-shadow 320ms cubic-bezier(0.22, 0.9, 0.32, 1), transform 200ms ease;
                    animation: apex-button-pulse 3s ease-in-out infinite;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }

                @keyframes apex-button-pulse {
                    0%, 100% { box-shadow: var(--apex-shadow-closed), 0 0 0 0 rgba(59, 130, 246, 0.4); }
                    50% { box-shadow: var(--apex-shadow-closed), 0 0 0 12px rgba(59, 130, 246, 0); }
                }

                #apex-chat-button:hover { transform: scale(1.08); }
                #apex-chat-button:active { transform: scale(0.96); }
                #apex-chat-button svg { width: 24px; height: 24px; stroke: white; stroke-width: 2; }
                #apex-chat-button.morphing { opacity: 0; transform: scale(0); pointer-events: none; }

                #apex-proactive-greeting {
                    position: fixed;
                    bottom: 100px;
                    right: 24px;
                    max-width: 280px;
                    padding: 14px 18px;
                    background: var(--apex-card);
                    color: var(--apex-text);
                    border: 1px solid var(--apex-border);
                    border-radius: 16px;
                    border-bottom-right-radius: 4px;
                    font-size: 14px;
                    line-height: 1.5;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(59, 130, 246, 0.1);
                    z-index: 9998;
                    opacity: 0;
                    pointer-events: none;
                    animation: apex-greeting-fade-in 480ms cubic-bezier(0.22, 0.9, 0.32, 1) forwards;
                    animation-delay: 5s;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }

                @keyframes apex-greeting-fade-in {
                    0% { opacity: 0; transform: translateY(12px) translateX(4px); }
                    100% { opacity: 0.95; transform: translateY(0) translateX(0); }
                }

                @keyframes apex-greeting-fade-out {
                    0% { opacity: 0.95; transform: translateY(0) translateX(0); }
                    100% { opacity: 0; transform: translateY(12px) translateX(4px); pointer-events: none; }
                }

                #apex-chat-window {
                    position: fixed;
                    bottom: 100px;
                    right: 24px;
                    width: 400px;
                    height: 650px;
                    background: var(--apex-dark);
                    border-radius: 16px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    z-index: 9999;
                    border: 1px solid var(--apex-border);
                    transform: translate(155px, 155px) scale(0.3) translateZ(0);
                    opacity: 0;
                    pointer-events: none;
                    box-shadow: var(--apex-shadow-closed);
                    transition: transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 500ms cubic-bezier(0.22, 0.9, 0.32, 1), box-shadow 480ms cubic-bezier(0.22, 0.9, 0.32, 1);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }

                #apex-chat-window.open {
                    transform: translate(0, 0) scale(1) translateZ(0);
                    opacity: 1;
                    pointer-events: auto;
                    box-shadow: var(--apex-shadow-open);
                }

                #apex-chat-header {
                    background: linear-gradient(110deg, #1e40af 0%, var(--apex-blue) 20%, #60a5fa 40%, var(--apex-blue) 60%, #1e40af 100%);
                    background-size: 300% 100%;
                    color: white;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    animation: apex-cascade-in 400ms cubic-bezier(0.22, 0.9, 0.32, 1) forwards, apex-header-sweep 12s linear infinite;
                    animation-delay: 100ms, 0.5s;
                    flex-shrink: 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    position: relative;
                    overflow: hidden;
                }

                #apex-chat-header::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%);
                    animation: apex-header-shimmer-sweep 8s ease-in-out infinite;
                    pointer-events: none;
                }

                @keyframes apex-header-sweep {
                    0% { background-position: 0% 0%; }
                    100% { background-position: 300% 0%; }
                }

                @keyframes apex-header-shimmer-sweep {
                    0% { left: -100%; }
                    100% { left: 200%; }
                }

                #apex-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    backdrop-filter: blur(10px);
                    position: relative;
                    z-index: 1;
                }

                #apex-avatar svg { width: 20px; height: 20px; stroke: white; }

                #apex-header-text { display: flex; flex-direction: column; gap: 3px; flex: 1; }
                #apex-header-title { font-weight: 600; font-size: 16px; letter-spacing: -0.3px; color: white; }
                #apex-header-subtitle { 
                    font-size: 13px; 
                    color: rgba(255, 255, 255, 0.9); 
                    font-weight: 400;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                #apex-header-model { 
                    font-size: 12px; 
                    color: rgba(255, 255, 255, 0.7); 
                    font-weight: 400;
                    letter-spacing: 0.5px;
                }

                .apex-status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #22c55e;
                    box-shadow: 0 0 8px #22c55e, 0 0 16px rgba(34, 197, 94, 0.5);
                    animation: apex-status-pulse 3s ease-in-out infinite;
                    position: relative;
                }

                .apex-status-indicator::before {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    background: #22c55e;
                    animation: apex-status-ripple 3s ease-out infinite;
                }

                @keyframes apex-status-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }

                @keyframes apex-status-ripple {
                    0% { 
                        width: 100%; 
                        height: 100%; 
                        opacity: 0.8;
                    }
                    100% { 
                        width: 200%; 
                        height: 200%; 
                        opacity: 0;
                    }
                }

                #apex-close-btn {
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 18px;
                    transition: transform 180ms ease;
                    opacity: 0.8;
                }

                #apex-close-btn:hover { transform: rotate(90deg); opacity: 1; }

                #apex-chat-messages {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    background: var(--apex-dark);
                    min-height: 0;
                }

                #apex-chat-messages::-webkit-scrollbar { width: 4px; }
                #apex-chat-messages::-webkit-scrollbar-track { background: transparent; }
                #apex-chat-messages::-webkit-scrollbar-thumb { background: var(--apex-border); border-radius: 2px; }

                .apex-message {
                    max-width: 85%;
                    padding: 10px 14px;
                    border-radius: 16px;
                    font-size: 14px;
                    line-height: 1.4;
                    animation: apex-slideUpFade 300ms cubic-bezier(0.22, 0.9, 0.32, 1) forwards;
                    word-wrap: break-word;
                }

                @keyframes apex-slideUpFade {
                    0% { opacity: 0; transform: translateY(15px); }
                    100% { opacity: 1; transform: translateY(0); }
                }

                .apex-bot-message { background: var(--apex-card); color: var(--apex-text); align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid var(--apex-border); }
                .apex-user-message { background: linear-gradient(135deg, var(--apex-blue) 0%, #2563EB 100%); color: white; align-self: flex-end; border-bottom-right-radius: 4px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3); }

                .apex-typing-bubble {
                    max-width: 85%;
                    padding: 12px 14px;
                    border-radius: 16px;
                    border-bottom-left-radius: 4px;
                    align-self: flex-start;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    animation: apex-slideUpFade 300ms cubic-bezier(0.22, 0.9, 0.32, 1) forwards, apex-gradientShift 6s ease infinite;
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.1) 50%, rgba(236, 72, 153, 0.1) 100%);
                    background-size: 300% 300%;
                    border: 1px solid rgba(59, 130, 246, 0.2);
                }

                @keyframes apex-gradientShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                .apex-typing-logo {
                    width: 22px;
                    height: 22px;
                    border-radius: 6px;
                    background: linear-gradient(135deg, var(--apex-blue) 0%, #2563EB 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    color: white;
                    font-weight: bold;
                    flex-shrink: 0;
                }

                .apex-typing-text-wrapper { min-width: 260px; display: flex; align-items: center; transition: opacity 450ms ease; }
                .apex-typing-text-wrapper.text-fade-out { opacity: 0.3; }
                .apex-typing-text { font-size: 14px; color: var(--apex-text); font-weight: 400; }

                #apex-chat-input-area {
                    display: flex;
                    padding: 16px;
                    border-top: 1px solid var(--apex-border);
                    background: var(--apex-dark);
                    gap: 10px;
                    animation: apex-cascade-in 400ms cubic-bezier(0.22, 0.9, 0.32, 1) forwards;
                    animation-delay: 200ms;
                    flex-shrink: 0;
                }

                #apex-chat-input {
                    flex: 1;
                    padding: 12px 16px;
                    border: 1px solid var(--apex-border);
                    border-radius: 12px;
                    outline: none;
                    font-size: 14px;
                    background: var(--apex-card);
                    color: var(--apex-text);
                    font-family: inherit;
                    transition: border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease;
                }

                #apex-chat-input::placeholder { color: var(--apex-text-muted); }
                #apex-chat-input:focus { border-color: var(--apex-blue); background: var(--apex-card); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }

                #apex-send-btn {
                    background: linear-gradient(135deg, var(--apex-blue) 0%, #2563EB 100%);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    width: 44px;
                    height: 44px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                    transition: transform 150ms ease, box-shadow 150ms ease;
                    flex-shrink: 0;
                    font-family: inherit;
                }

                #apex-send-btn svg { width: 20px; height: 20px; }
                #apex-send-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4); }
                #apex-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                #apex-image-upload-wrapper {
                    display: flex;
                    gap: 8px;
                }

                #apex-image-btn {
                    background: var(--apex-card);
                    color: var(--apex-text-muted);
                    border: 1px solid var(--apex-border);
                    border-radius: 12px;
                    width: 44px;
                    height: 44px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 150ms ease, border-color 150ms ease, color 150ms ease;
                    flex-shrink: 0;
                    font-family: inherit;
                }

                #apex-image-btn svg { width: 20px; height: 20px; }
                #apex-image-btn:hover { transform: scale(1.05); border-color: var(--apex-blue); color: var(--apex-blue); }
                #apex-image-btn:active { transform: scale(0.95); }

                #apex-image-preview-wrapper {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }

                #apex-image-preview {
                    width: 44px;
                    height: 44px;
                    border-radius: 10px;
                    background-size: cover;
                    background-position: center;
                    border: 2px solid var(--apex-blue);
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                }

                #apex-image-remove-btn {
                    background: var(--apex-card);
                    color: #ef4444;
                    border: 1px solid var(--apex-border);
                    border-radius: 8px;
                    width: 32px;
                    height: 32px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: bold;
                    transition: background 150ms ease, transform 150ms ease, border-color 150ms ease;
                    flex-shrink: 0;
                }

                #apex-image-remove-btn:hover { background: #ef4444; color: white; transform: scale(1.05); border-color: #ef4444; }

                .apex-form-section {
                    padding: 16px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    animation: apex-cascade-in 400ms cubic-bezier(0.22, 0.9, 0.32, 1) forwards;
                    animation-delay: 150ms;
                    flex-shrink: 0;
                    border-bottom: 1px solid var(--apex-border);
                    background: var(--apex-dark);
                }

                .apex-form-section.select-hidden { 
                    opacity: 0; 
                    transform: translateY(-8px); 
                    pointer-events: none; 
                    max-height: 0; 
                    padding: 0; 
                    border: none;
                }

                .apex-form-row {
                    display: flex;
                    gap: 10px;
                    width: 100%;
                }

                .apex-form-disclaimer {
                    font-size: 11px;
                    color: rgba(148, 163, 184, 0.6);
                    line-height: 1.4;
                    margin-top: 8px;
                    padding: 0 4px;
                    font-weight: 400;
                    letter-spacing: 0.3px;
                    opacity: 0.7;
                }

                .apex-input,
                .apex-select {
                    appearance: none;
                    -webkit-appearance: none;
                    padding: 12px 14px;
                    border: 1px solid var(--apex-border);
                    border-radius: 10px;
                    background: var(--apex-card);
                    font-size: 14px;
                    color: var(--apex-text);
                    font-family: inherit;
                    line-height: 1.4;
                    width: 100%;
                    transition: border-color 200ms ease, box-shadow 200ms ease;
                }

                .apex-input::placeholder {
                    color: var(--apex-text-muted);
                }

                .apex-select {
                    cursor: pointer;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394A3B8' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 14px center;
                    padding-right: 40px;
                }

                .apex-select:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .apex-input:hover,
                .apex-select:hover:not(:disabled) { 
                    border-color: var(--apex-blue); 
                }

                .apex-input:focus,
                .apex-select:focus { 
                    outline: none; 
                    border-color: var(--apex-blue); 
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); 
                }

                @keyframes apex-cascade-in {
                    0% { opacity: 0; transform: translateY(8px); }
                    100% { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 480px) {
                    #apex-chat-window {
                        width: calc(100vw - 32px);
                        height: calc(100vh - 120px);
                        right: 16px;
                        bottom: 90px;
                    }
                    
                    .apex-form-row-split {
                        flex-direction: column;
                    }
                }

                @media (max-width: 768px) {
                    .apex-input,
                    .apex-select,
                    #apex-chat-input {
                        font-size: 16px;
                    }
                }
            `;
        }
    };
})();

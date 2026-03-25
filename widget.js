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

    const SCRIPT_BASE_URL = (function(){
        try {
            let s = document.currentScript;
            if (!s) {
                const scripts = document.getElementsByTagName('script');
                s = scripts[scripts.length - 1];
            }
            const src = s && s.src ? s.src : window.location.href;
            const resolved = new URL(src, window.location.href);
            return new URL('./', resolved).toString();
        } catch (e) {
            return window.location.href;
        }
    })();

    window.ApexWidget = {
        BUILD_VERSION: "3.22.v6L8",
        // Configuration (read overrides from script query params)
        SHOP_ID: SCRIPT_PARAMS.get('shopId') || "1019",
        PRIMARY_COLOR: SCRIPT_PARAMS.get('primaryColor') || SCRIPT_PARAMS.get('primary') || "#3B82F6",
        SECONDARY_COLOR: SCRIPT_PARAMS.get('secondaryColor') || SCRIPT_PARAMS.get('secondary') || "#1E293B",
        TEXT_COLOR: SCRIPT_PARAMS.get('textColor') || SCRIPT_PARAMS.get('text') || "#F1F5F9",
        SESSION_ID: "user_" + Math.random().toString(36).substr(2, 9),
        // Optional URL to fetch shop config (colors) by shop id.

        IMAGE_TRANSPORT: (SCRIPT_PARAMS.get('imageTransport') || 'json').toLowerCase(),

        N8N_WEBHOOK_URL: "https://api.usevetra.com/webhook/281ba64b-e245-4ea6-9003-74d79997eb34",

        // State
        chatIsOpen: false,
        isTyping: false,
        messageCount: 0,
        loadingMessageIdx: 0,
        loadingInterval: null,
        modelCache: {},
        viewportHandlersBound: false,
        viewportRafId: null,
        viewportChangeHandler: null,
        lastKeyboardOffset: 0,
        keyboardShortcutBound: false,
        imageIsProcessing: false,
        imageProcessingPromise: null,
        imageUploadToken: 0,

        // Consumer-only makes supported by hardcoded year/model data (2005-2025)
        COMMON_MAKES: [
            "Acura", "Cadillac", "Chrysler", "Dodge", "Ford", "Genesis", "Honda", "Hyundai", "Jaguar", "Lexus", "MINI", "Mitsubishi", "Ram", "Volkswagen", "Volvo"
        ],

        // Hardcoded model ranges by make to prevent invalid year/model combinations.
        // Each model appears only for valid years in the 2005-2025 window.
        HARD_CODED_MODEL_RANGES: {
            "Acura": [
                { model: "CSX", minYear: 2006, maxYear: 2011 },
                { model: "ILX", minYear: 2013, maxYear: 2022 },
                { model: "Integra", minYear: 2023, maxYear: 2025 },
                { model: "MDX", minYear: 2005, maxYear: 2025 },
                { model: "NSX", minYear: 2017, maxYear: 2022 },
                { model: "RDX", minYear: 2007, maxYear: 2025 },
                { model: "RL", minYear: 2005, maxYear: 2012 },
                { model: "RLX", minYear: 2014, maxYear: 2020 },
                { model: "RSX", minYear: 2005, maxYear: 2006 },
                { model: "TL", minYear: 2005, maxYear: 2014 },
                { model: "TLX", minYear: 2015, maxYear: 2025 },
                { model: "TSX", minYear: 2005, maxYear: 2014 },
                { model: "ZDX", minYear: 2010, maxYear: 2013 },
                { model: "ZDX", minYear: 2024, maxYear: 2025 }
            ],
            "Cadillac": [
                { model: "ATS", minYear: 2013, maxYear: 2019 },
                { model: "ATS-V", minYear: 2016, maxYear: 2019 },
                { model: "CT4", minYear: 2020, maxYear: 2025 },
                { model: "CT4-V", minYear: 2020, maxYear: 2025 },
                { model: "CT5", minYear: 2020, maxYear: 2025 },
                { model: "CT5-V", minYear: 2020, maxYear: 2025 },
                { model: "CT6", minYear: 2016, maxYear: 2020 },
                { model: "CTS", minYear: 2005, maxYear: 2019 },
                { model: "CTS-V", minYear: 2005, maxYear: 2019 },
                { model: "DTS", minYear: 2006, maxYear: 2011 },
                { model: "ELR", minYear: 2014, maxYear: 2016 },
                { model: "Escalade", minYear: 2005, maxYear: 2025 },
                { model: "Lyriq", minYear: 2023, maxYear: 2025 },
                { model: "SRX", minYear: 2005, maxYear: 2016 },
                { model: "STS", minYear: 2005, maxYear: 2011 },
                { model: "XLR", minYear: 2005, maxYear: 2009 },
                { model: "XT4", minYear: 2019, maxYear: 2025 },
                { model: "XT5", minYear: 2017, maxYear: 2025 },
                { model: "XT6", minYear: 2020, maxYear: 2025 }
            ],
            "Chrysler": [
                { model: "200", minYear: 2011, maxYear: 2017 },
                { model: "300", minYear: 2005, maxYear: 2025 },
                { model: "Aspen", minYear: 2007, maxYear: 2009 },
                { model: "Crossfire", minYear: 2005, maxYear: 2008 },
                { model: "Pacifica", minYear: 2005, maxYear: 2008 },
                { model: "Pacifica", minYear: 2017, maxYear: 2025 },
                { model: "PT Cruiser", minYear: 2005, maxYear: 2010 },
                { model: "Sebring", minYear: 2005, maxYear: 2010 },
                { model: "Town & Country", minYear: 2005, maxYear: 2016 },
                { model: "Voyager", minYear: 2020, maxYear: 2025 }
            ],
            "Dodge": [
                { model: "Avenger", minYear: 2008, maxYear: 2014 },
                { model: "Caliber", minYear: 2007, maxYear: 2012 },
                { model: "Challenger", minYear: 2008, maxYear: 2025 },
                { model: "Charger", minYear: 2005, maxYear: 2025 },
                { model: "Dakota", minYear: 2005, maxYear: 2011 },
                { model: "Dart", minYear: 2013, maxYear: 2016 },
                { model: "Durango", minYear: 2005, maxYear: 2025 },
                { model: "Grand Caravan", minYear: 2005, maxYear: 2020 },
                { model: "Hornet", minYear: 2023, maxYear: 2025 },
                { model: "Journey", minYear: 2009, maxYear: 2020 },
                { model: "Magnum", minYear: 2005, maxYear: 2008 },
                { model: "Nitro", minYear: 2007, maxYear: 2012 },
                { model: "Viper", minYear: 2013, maxYear: 2017 }
            ],
            "Ford": [
                { model: "Bronco", minYear: 2021, maxYear: 2025 },
                { model: "Bronco Sport", minYear: 2021, maxYear: 2025 },
                { model: "C-Max", minYear: 2013, maxYear: 2018 },
                { model: "Crown Victoria", minYear: 2005, maxYear: 2011 },
                { model: "E-Series", minYear: 2005, maxYear: 2014 },
                { model: "EcoSport", minYear: 2018, maxYear: 2022 },
                { model: "Edge", minYear: 2007, maxYear: 2024 },
                { model: "Escape", minYear: 2005, maxYear: 2025 },
                { model: "Excursion", minYear: 2005, maxYear: 2005 },
                { model: "Expedition", minYear: 2005, maxYear: 2025 },
                { model: "Explorer", minYear: 2005, maxYear: 2025 },
                { model: "F-150", minYear: 2005, maxYear: 2025 },
                { model: "F-250", minYear: 2005, maxYear: 2025 },
                { model: "F-350", minYear: 2005, maxYear: 2025 },
                { model: "F-450", minYear: 2005, maxYear: 2025 },
                { model: "Fiesta", minYear: 2011, maxYear: 2019 },
                { model: "Five Hundred", minYear: 2005, maxYear: 2007 },
                { model: "Flex", minYear: 2009, maxYear: 2019 },
                { model: "Focus", minYear: 2005, maxYear: 2018 },
                { model: "Freestar", minYear: 2005, maxYear: 2007 },
                { model: "Freestyle", minYear: 2005, maxYear: 2007 },
                { model: "Fusion", minYear: 2006, maxYear: 2020 },
                { model: "GT", minYear: 2005, maxYear: 2006 },
                { model: "GT", minYear: 2017, maxYear: 2022 },
                { model: "Maverick", minYear: 2022, maxYear: 2025 },
                { model: "Mustang", minYear: 2005, maxYear: 2025 },
                { model: "Mustang Mach-E", minYear: 2021, maxYear: 2025 },
                { model: "Ranger", minYear: 2005, maxYear: 2012 },
                { model: "Ranger", minYear: 2019, maxYear: 2025 },
                { model: "Taurus", minYear: 2005, maxYear: 2019 },
                { model: "Taurus X", minYear: 2008, maxYear: 2009 },
                { model: "Thunderbird", minYear: 2005, maxYear: 2005 },
                { model: "Transit", minYear: 2015, maxYear: 2025 },
                { model: "Transit Connect", minYear: 2010, maxYear: 2023 }
            ],
            "Genesis": [
                { model: "G70", minYear: 2019, maxYear: 2025 },
                { model: "G80", minYear: 2017, maxYear: 2025 },
                { model: "G90", minYear: 2017, maxYear: 2025 },
                { model: "GV60", minYear: 2023, maxYear: 2025 },
                { model: "GV70", minYear: 2022, maxYear: 2025 },
                { model: "GV80", minYear: 2021, maxYear: 2025 }
            ],
            "Honda": [
                { model: "Accord", minYear: 2005, maxYear: 2025 },
                { model: "Civic", minYear: 2005, maxYear: 2025 },
                { model: "Clarity", minYear: 2017, maxYear: 2021 },
                { model: "Crosstour", minYear: 2010, maxYear: 2015 },
                { model: "CR-V", minYear: 2005, maxYear: 2025 },
                { model: "CR-Z", minYear: 2011, maxYear: 2016 },
                { model: "Element", minYear: 2005, maxYear: 2011 },
                { model: "Fit", minYear: 2007, maxYear: 2020 },
                { model: "HR-V", minYear: 2016, maxYear: 2025 },
                { model: "Insight", minYear: 2010, maxYear: 2014 },
                { model: "Insight", minYear: 2019, maxYear: 2022 },
                { model: "Odyssey", minYear: 2005, maxYear: 2025 },
                { model: "Passport", minYear: 2019, maxYear: 2025 },
                { model: "Pilot", minYear: 2005, maxYear: 2025 },
                { model: "Prologue", minYear: 2024, maxYear: 2025 },
                { model: "Ridgeline", minYear: 2006, maxYear: 2025 },
                { model: "S2000", minYear: 2005, maxYear: 2009 }
            ],
            "Hyundai": [
                { model: "Accent", minYear: 2005, maxYear: 2022 },
                { model: "Azera", minYear: 2006, maxYear: 2017 },
                { model: "Elantra", minYear: 2005, maxYear: 2025 },
                { model: "Entourage", minYear: 2007, maxYear: 2009 },
                { model: "Equus", minYear: 2011, maxYear: 2016 },
                { model: "Genesis", minYear: 2009, maxYear: 2016 },
                { model: "Ioniq", minYear: 2017, maxYear: 2022 },
                { model: "Ioniq 5", minYear: 2022, maxYear: 2025 },
                { model: "Ioniq 6", minYear: 2023, maxYear: 2025 },
                { model: "Kona", minYear: 2018, maxYear: 2025 },
                { model: "Kona Electric", minYear: 2019, maxYear: 2025 },
                { model: "Nexo", minYear: 2019, maxYear: 2025 },
                { model: "Palisade", minYear: 2020, maxYear: 2025 },
                { model: "Santa Cruz", minYear: 2022, maxYear: 2025 },
                { model: "Santa Fe", minYear: 2005, maxYear: 2025 },
                { model: "Sonata", minYear: 2005, maxYear: 2025 },
                { model: "Tiburon", minYear: 2005, maxYear: 2008 },
                { model: "Tucson", minYear: 2005, maxYear: 2025 },
                { model: "Veloster", minYear: 2012, maxYear: 2022 },
                { model: "Venue", minYear: 2020, maxYear: 2025 },
                { model: "Veracruz", minYear: 2007, maxYear: 2012 },
                { model: "XG350", minYear: 2005, maxYear: 2005 }
            ],
            "Jaguar": [
                { model: "E-PACE", minYear: 2018, maxYear: 2025 },
                { model: "F-PACE", minYear: 2017, maxYear: 2025 },
                { model: "F-TYPE", minYear: 2014, maxYear: 2024 },
                { model: "I-PACE", minYear: 2019, maxYear: 2025 },
                { model: "S-TYPE", minYear: 2005, maxYear: 2008 },
                { model: "X-TYPE", minYear: 2005, maxYear: 2009 },
                { model: "XE", minYear: 2017, maxYear: 2020 },
                { model: "XF", minYear: 2009, maxYear: 2025 },
                { model: "XJ", minYear: 2005, maxYear: 2019 },
                { model: "XK", minYear: 2007, maxYear: 2015 }
            ],
            "Lexus": [
                { model: "CT 200h", minYear: 2011, maxYear: 2017 },
                { model: "ES", minYear: 2005, maxYear: 2025 },
                { model: "GS", minYear: 2005, maxYear: 2020 },
                { model: "GX", minYear: 2005, maxYear: 2025 },
                { model: "HS 250h", minYear: 2010, maxYear: 2012 },
                { model: "IS", minYear: 2005, maxYear: 2025 },
                { model: "LC", minYear: 2018, maxYear: 2025 },
                { model: "LFA", minYear: 2011, maxYear: 2012 },
                { model: "LM", minYear: 2024, maxYear: 2025 },
                { model: "LS", minYear: 2005, maxYear: 2025 },
                { model: "LX", minYear: 2005, maxYear: 2025 },
                { model: "NX", minYear: 2015, maxYear: 2025 },
                { model: "RC", minYear: 2015, maxYear: 2025 },
                { model: "RZ", minYear: 2023, maxYear: 2025 },
                { model: "RX", minYear: 2005, maxYear: 2025 },
                { model: "SC", minYear: 2005, maxYear: 2010 },
                { model: "TX", minYear: 2024, maxYear: 2025 },
                { model: "UX", minYear: 2019, maxYear: 2025 }
            ],
            "MINI": [
                { model: "Clubman", minYear: 2008, maxYear: 2024 },
                { model: "Convertible", minYear: 2005, maxYear: 2025 },
                { model: "Cooper", minYear: 2005, maxYear: 2025 },
                { model: "Cooper Countryman", minYear: 2011, maxYear: 2025 },
                { model: "Cooper Coupe", minYear: 2012, maxYear: 2015 },
                { model: "Cooper Hardtop", minYear: 2005, maxYear: 2025 },
                { model: "Cooper Paceman", minYear: 2013, maxYear: 2016 },
                { model: "Cooper Roadster", minYear: 2012, maxYear: 2015 },
                { model: "Countryman", minYear: 2011, maxYear: 2025 },
                { model: "Hardtop 2 Door", minYear: 2014, maxYear: 2025 },
                { model: "Hardtop 4 Door", minYear: 2015, maxYear: 2025 }
            ],
            "Mitsubishi": [
                { model: "3000GT", minYear: 2005, maxYear: 2005 },
                { model: "Eclipse", minYear: 2005, maxYear: 2012 },
                { model: "Eclipse Cross", minYear: 2018, maxYear: 2025 },
                { model: "Endeavor", minYear: 2005, maxYear: 2011 },
                { model: "Galant", minYear: 2005, maxYear: 2012 },
                { model: "i-MiEV", minYear: 2012, maxYear: 2017 },
                { model: "Lancer", minYear: 2005, maxYear: 2017 },
                { model: "Mirage", minYear: 2014, maxYear: 2025 },
                { model: "Mirage G4", minYear: 2017, maxYear: 2025 },
                { model: "Montero", minYear: 2005, maxYear: 2006 },
                { model: "Outlander", minYear: 2005, maxYear: 2025 },
                { model: "Outlander PHEV", minYear: 2018, maxYear: 2025 },
                { model: "Outlander Sport", minYear: 2011, maxYear: 2025 },
                { model: "Raider", minYear: 2006, maxYear: 2009 }
            ],
            "Ram": [
                { model: "1500", minYear: 2011, maxYear: 2025 },
                { model: "1500 Classic", minYear: 2019, maxYear: 2025 },
                { model: "2500", minYear: 2011, maxYear: 2025 },
                { model: "3500", minYear: 2011, maxYear: 2025 },
                { model: "4500", minYear: 2011, maxYear: 2025 },
                { model: "ProMaster", minYear: 2014, maxYear: 2025 },
                { model: "ProMaster City", minYear: 2015, maxYear: 2022 }
            ],
            "Volkswagen": [
                { model: "Arteon", minYear: 2019, maxYear: 2024 },
                { model: "Atlas", minYear: 2018, maxYear: 2025 },
                { model: "Atlas Cross Sport", minYear: 2020, maxYear: 2025 },
                { model: "Beetle", minYear: 2012, maxYear: 2019 },
                { model: "CC", minYear: 2009, maxYear: 2017 },
                { model: "e-Golf", minYear: 2015, maxYear: 2019 },
                { model: "EOS", minYear: 2007, maxYear: 2016 },
                { model: "Golf", minYear: 2005, maxYear: 2021 },
                { model: "Golf Alltrack", minYear: 2017, maxYear: 2019 },
                { model: "Golf GTI", minYear: 2005, maxYear: 2025 },
                { model: "Golf R", minYear: 2012, maxYear: 2025 },
                { model: "GTI", minYear: 2005, maxYear: 2025 },
                { model: "ID.4", minYear: 2021, maxYear: 2025 },
                { model: "Jetta", minYear: 2005, maxYear: 2025 },
                { model: "Jetta GLI", minYear: 2005, maxYear: 2025 },
                { model: "Passat", minYear: 2005, maxYear: 2022 },
                { model: "Phaeton", minYear: 2005, maxYear: 2006 },
                { model: "R32", minYear: 2008, maxYear: 2008 },
                { model: "Rabbit", minYear: 2006, maxYear: 2009 },
                { model: "Taos", minYear: 2022, maxYear: 2025 },
                { model: "Tiguan", minYear: 2009, maxYear: 2025 },
                { model: "Touareg", minYear: 2005, maxYear: 2017 }
            ],
            "Volvo": [
                { model: "C30", minYear: 2008, maxYear: 2013 },
                { model: "C40 Recharge", minYear: 2022, maxYear: 2025 },
                { model: "C70", minYear: 2006, maxYear: 2013 },
                { model: "S40", minYear: 2005, maxYear: 2011 },
                { model: "S60", minYear: 2005, maxYear: 2025 },
                { model: "S80", minYear: 2005, maxYear: 2016 },
                { model: "S90", minYear: 2017, maxYear: 2025 },
                { model: "V50", minYear: 2005, maxYear: 2011 },
                { model: "V60", minYear: 2015, maxYear: 2025 },
                { model: "V70", minYear: 2005, maxYear: 2010 },
                { model: "V90", minYear: 2017, maxYear: 2025 },
                { model: "XC40", minYear: 2019, maxYear: 2025 },
                { model: "XC60", minYear: 2009, maxYear: 2025 },
                { model: "XC70", minYear: 2005, maxYear: 2016 },
                { model: "XC90", minYear: 2005, maxYear: 2025 },
                { model: "EX30", minYear: 2025, maxYear: 2025 },
                { model: "EX90", minYear: 2025, maxYear: 2025 }
            ]
        },

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

        pendingModelRequestId: 0,

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
                container.style.setProperty('--apex-runtime-vh', `${window.innerHeight}px`);
                container.style.setProperty('--apex-keyboard-offset', '0px');
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
                prideTextDiv: container.querySelector('#apex-proactive-greeting'),
                
                yearSelect: container.querySelector('#apex-year-select'),
                makeSelect: container.querySelector('#apex-make-select'),
                modelSelect: container.querySelector('#apex-model-select'),
                mileageRange: container.querySelector('#apex-mileage-range'),
                mileageValue: container.querySelector('#apex-mileage-value'),
                buildVersionPill: container.querySelector('#apex-build-version-pill'),
                
                vehicleWrap: container.querySelector('#apex-vehicle-selects'),
                contactName: container.querySelector('#apex-contact-name'),
                contactPhone: container.querySelector('#apex-contact-phone'),
                contactConsent: container.querySelector('#apex-contact-consent'),
                contactConsentError: container.querySelector('#apex-contact-consent-error'),
                closeBtn: container.querySelector('#apex-close-btn'),
                
                inputField: container.querySelector('#apex-chat-input'),
                testFillBtn: container.querySelector('#apex-test-fill-btn'),
                sendBtn: container.querySelector('#apex-send-btn'),
                cameraBtn: container.querySelector('#apex-image-btn-camera'),
                galleryBtn: container.querySelector('#apex-image-btn-gallery'),
                cameraInput: container.querySelector('#apex-image-input-camera'),
                galleryInput: container.querySelector('#apex-image-input-gallery'),
                imagePreviewWrapper: container.querySelector('#apex-image-preview-wrapper'),
                imagePreview: container.querySelector('#apex-image-preview'),
                imageRemoveBtn: container.querySelector('#apex-image-remove-btn'),
                imageUploadWrapper: container.querySelector('#apex-image-upload-wrapper'),
                imageDataHolder: container.querySelector('#apex-image-data-holder')
            };
        },

        setupListeners() {
            console.log('[ApexWidget] Setting up event listeners with delegation');
            const { backdrop, makeSelect, yearSelect, mileageRange, chatButton, inputField, sendBtn } = this.elements;
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

            if (yearSelect) {
                yearSelect.addEventListener('change', () => self.onMakeChange());
            }

            if (mileageRange) {
                mileageRange.addEventListener('input', () => self.updateMileageUI());
                mileageRange.addEventListener('change', () => self.updateMileageUI());
                mileageRange.addEventListener('pointerdown', () => {
                    mileageRange.classList.add('is-dragging');
                });
                mileageRange.addEventListener('pointerup', () => {
                    mileageRange.classList.remove('is-dragging');
                });
                mileageRange.addEventListener('pointercancel', () => {
                    mileageRange.classList.remove('is-dragging');
                });
            }

            if (inputField) {
                inputField.addEventListener('keypress', (e) => self.handleKeyPress(e));
            }

            if (sendBtn) {
                sendBtn.addEventListener('click', () => self.sendMessage());
            }

            if (this.elements.testFillBtn) {
                this.elements.testFillBtn.addEventListener('click', () => self.applyTestData());
            }

            if (this.elements.contactConsent) {
                this.elements.contactConsent.addEventListener('change', () => {
                    if (self.elements.contactConsent.checked && self.elements.contactConsentError) {
                        self.elements.contactConsentError.style.display = 'none';
                    }
                });
            }

            const cameraBtn = this.elements.cameraBtn;
            const galleryBtn = this.elements.galleryBtn;
            const cameraInput = this.elements.cameraInput;
            const galleryInput = this.elements.galleryInput;
            const imageRemoveBtn = this.elements.imageRemoveBtn;

            if (cameraBtn && cameraInput) {
                cameraBtn.addEventListener('click', () => cameraInput.click());
            }

            if (galleryBtn && galleryInput) {
                galleryBtn.addEventListener('click', () => galleryInput.click());
            }

            if (cameraInput) {
                cameraInput.addEventListener('change', (e) => self.handleImageUpload(e));
            }

            if (galleryInput) {
                galleryInput.addEventListener('change', (e) => self.handleImageUpload(e));
            }

            if (imageRemoveBtn) {
                imageRemoveBtn.addEventListener('click', () => self.removeImage());
            }
        },

        init() {
            console.log(`[ApexWidget] Build ${this.BUILD_VERSION} loaded`);
            this.appendBotMessage("Hi! I'm Vetra your Virtual Service Advisor. I can help with repair estimates, diagnostics, or answer any questions about your vehicle. What can I help you with today?", false);
            this.populateYears();
            this.elements.makeSelect.disabled = true;
            this.loadExtendedVehicleData()
                .catch((error) => {
                    console.warn('[ApexWidget] Extended vehicle data failed to load, using built-in fallback:', error);
                })
                .finally(() => {
                    this.populateMakes();
                    this.elements.makeSelect.disabled = false;
                });
            this.updateMileageUI();
            if (this.elements.buildVersionPill) {
                this.elements.buildVersionPill.textContent = `Build ${this.BUILD_VERSION}`;
            }
            this.setupViewportHandling();
            this.setupGlobalShortcut();
            // If embed only provided shopId, optionally fetch colors/config from backend
            this.loadRemoteConfigIfNeeded();
            
            // Schedule proactive greeting to disappear after 5 seconds of being visible
            const self = this;
            setTimeout(() => {
                const greetingEl = self.elements.prideTextDiv;
                if (greetingEl) {
                    greetingEl.style.animation = 'apex-greeting-fade-out 400ms cubic-bezier(0.22, 0.9, 0.32, 1) forwards';
                }
            }, 10000); // 5s delay + 5s visible = 10s total
        },

        async loadExtendedVehicleData() {
            const dataUrl = new URL('generated_hardcoded_ranges.json', SCRIPT_BASE_URL).toString();
            const response = await fetch(dataUrl, { cache: 'force-cache' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const extraMakes = Array.isArray(data?.COMMON_MAKES) ? data.COMMON_MAKES : [];
            const extraRanges = data?.HARD_CODED_MODEL_RANGES && typeof data.HARD_CODED_MODEL_RANGES === 'object'
                ? data.HARD_CODED_MODEL_RANGES
                : {};

            this.COMMON_MAKES = [...new Set([...this.COMMON_MAKES, ...extraMakes])]
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));

            this.HARD_CODED_MODEL_RANGES = {
                ...this.HARD_CODED_MODEL_RANGES,
                ...extraRanges
            };
        },

        setupViewportHandling() {
            if (this.viewportHandlersBound) return;

            const handleViewportChange = () => {
                if (this.viewportRafId) {
                    cancelAnimationFrame(this.viewportRafId);
                }
                this.viewportRafId = requestAnimationFrame(() => {
                    this.viewportRafId = null;
                    this.updateViewportMetrics();
                });
            };

            this.viewportChangeHandler = handleViewportChange;

            window.addEventListener('resize', handleViewportChange, { passive: true });
            window.addEventListener('orientationchange', handleViewportChange, { passive: true });

            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', handleViewportChange);
                window.visualViewport.addEventListener('scroll', handleViewportChange);
            }

            this.viewportHandlersBound = true;
            this.updateViewportMetrics();
        },

        setupGlobalShortcut() {
            if (this.keyboardShortcutBound) return;

            document.addEventListener('keydown', (event) => {
                const target = event.target;
                const tagName = target && target.tagName ? target.tagName.toLowerCase() : '';
                const isEditable = !!(target && (target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'));

                if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && String(event.key).toLowerCase() === 'o') {
                    if (isEditable) {
                        return;
                    }

                    event.preventDefault();
                    if (!this.chatIsOpen) {
                        this.openChat();
                    }

                    if (this.elements.inputField && !window.matchMedia('(max-width: 768px)').matches) {
                        this.elements.inputField.focus();
                    }
                }
            });

            this.keyboardShortcutBound = true;
        },

        updateViewportMetrics() {
            const container = document.getElementById('apex-widget-container');
            if (!container) return;

            const runtimeVh = window.innerHeight;
            const keyboardOffset = 0;

            this.lastKeyboardOffset = 0;

            container.style.setProperty('--apex-runtime-vh', `${runtimeVh}px`);
            container.style.setProperty('--apex-keyboard-offset', `${keyboardOffset}px`);
            this.updateMileageUI();
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
                            <div id="apex-header-title">Vetra Virtual Service Advisor</div>
                            <div id="apex-header-subtitle">
                                <span class="apex-status-indicator"></span>
                                <span>Online</span>
                            </div>
                            <div id="apex-header-model">Model - VETRA</div>
                        </div>
                        <div id="apex-build-version-pill" class="apex-build-version-pill"></div>
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
                        <div class="apex-form-row apex-mileage-row">
                            <div class="apex-mileage-header">
                                <span class="apex-mileage-label">Mileage</span>
                                <span id="apex-mileage-value" class="apex-mileage-value">0 mi</span>
                            </div>
                            <input
                                id="apex-mileage-range"
                                class="apex-mileage-range"
                                type="range"
                                min="0"
                                max="200000"
                                step="5000"
                                value="0"
                                aria-label="Vehicle mileage"
                            />
                        </div>
                        <div class="apex-consent-wrap">
                            <label class="apex-consent-label" for="apex-contact-consent">
                                <input id="apex-contact-consent" type="checkbox" class="apex-consent-checkbox" />
                                <span>
                                    I agree to receive SMS about this quote and service follow-ups (including reminder messages). Msg & data rates may apply. Reply STOP to opt-out. See <a href="https://usevetra.com/terms.html" target="_blank" rel="noopener noreferrer">Terms</a> and <a href="https://usevetra.com/privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a>.
                                </span>
                            </label>
                            <div id="apex-contact-consent-error" class="apex-consent-error">Please check the SMS consent box to continue.</div>
                        </div>
                        <div id="apex-form-scroll-hint" aria-hidden="true">
                            <svg width="20" height="14" viewBox="0 0 24 14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 2 12 12 22 2"/></svg>
                            <svg width="20" height="14" viewBox="0 0 24 14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 2 12 12 22 2"/></svg>
                        </div>
                    </div>
                    <div id="apex-chat-input-area">
                        <div id="apex-image-upload-wrapper">
                            <input type="file" id="apex-image-input-camera" accept="image/*" capture="environment" style="display: none;">
                            <input type="file" id="apex-image-input-gallery" accept="image/*" style="display: none;">
                            <button id="apex-image-btn-camera" aria-label="Take photo" title="Take photo">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                    <circle cx="12" cy="13" r="4"></circle>
                                </svg>
                            </button>
                            <button id="apex-image-btn-gallery" aria-label="Choose photo" title="Choose from gallery">
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
                    <button id="apex-test-fill-btn" aria-label="Fill test data" title="Fill test data">T</button>
                </div>
            `;
        },

        getHardcodedModelsForYear(make, year) {
            const yearNum = parseInt(year, 10);
            const ranges = this.HARD_CODED_MODEL_RANGES[make] || [];
            if (!Number.isFinite(yearNum) || !ranges.length) {
                return [];
            }

            const models = ranges
                .filter(entry => yearNum >= entry.minYear && yearNum <= entry.maxYear)
                .map(entry => entry.model)
                .filter(name => this.isModelAllowedForMake(name, make));

            return [...new Set(models)].sort((a, b) => a.localeCompare(b));
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
            const requestId = ++this.pendingModelRequestId;

            this.elements.modelSelect.innerHTML = '<option value="">Loading...</option>';
            this.elements.modelSelect.disabled = true;

            if (!year || !make) {
                this.elements.modelSelect.innerHTML = '<option value="">Select Model</option>';
                return;
            }

            const cacheKey = `${make}::${year}`;
            if (!this.modelCache[cacheKey]) {
                this.modelCache[cacheKey] = this.getHardcodedModelsForYear(make, year);
            }

            if (requestId !== this.pendingModelRequestId) {
                return;
            }

            this.populateModels(this.modelCache[cacheKey]);
        },

        populateYears() {
            const current = 2025;
            const start = 2005;
            this.elements.yearSelect.innerHTML = '<option value="">Year</option>';
            for (let y = current; y >= start; y--) {
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
            if (!window.matchMedia('(max-width: 768px)').matches) {
                this.elements.inputField.focus();
            }
            this.elements.prideTextDiv.style.opacity = '0';
            this.elements.prideTextDiv.style.pointerEvents = 'none';
            // Lock body scroll on mobile so swiping inside widget doesn't scroll the page
            if (window.matchMedia('(max-width: 768px)').matches) {
                document.body.style.overflow = 'hidden';
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
            }
            // Show scroll-down hint in form for 3s on mobile
            if (window.matchMedia('(max-width: 768px)').matches) {
                const hint = document.getElementById('apex-form-scroll-hint');
                if (hint) {
                    hint.classList.add('visible');
                    clearTimeout(this._hintTimer);
                    this._hintTimer = setTimeout(() => hint.classList.remove('visible'), 3000);
                }
            }
        },

        closeChat() {
            this.chatIsOpen = false;
            this.elements.chatButton.classList.remove('morphing');
            this.elements.chatWindow.classList.remove('open');
            this.elements.backdrop.classList.remove('visible');
            this.elements.prideTextDiv.style.opacity = '0.95';
            this.elements.prideTextDiv.style.pointerEvents = 'auto';
            // Restore body scroll
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        },

        normalizeBookingUrl(url) {
            if (typeof url !== 'string') return null;
            const trimmed = url.trim();
            if (!trimmed) return null;

            try {
                const parsed = new URL(trimmed, window.location.href);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    return null;
                }
                return parsed.toString();
            } catch (error) {
                return null;
            }
        },

        appendBookingButton(messageDiv, bookingUrl) {
            const safeBookingUrl = this.normalizeBookingUrl(bookingUrl);
            if (!messageDiv || !safeBookingUrl) return;

            const bookingLink = document.createElement('a');
            bookingLink.classList.add('apex-booking-link');
            bookingLink.href = safeBookingUrl;
            bookingLink.target = '_blank';
            bookingLink.rel = 'noopener noreferrer';
            bookingLink.setAttribute('aria-label', 'Book Drop-Off');
            bookingLink.innerHTML = '<span class="apex-booking-icon" aria-hidden="true">📅</span><span>Book Drop-Off</span>';

            messageDiv.appendChild(bookingLink);
        },

        appendBotMessage(text, typewriterEffect = true, bookingUrl = null) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('apex-message', 'apex-bot-message');
            messageDiv.innerHTML = '<span class="typing-text"></span>';
            this.elements.messagesDiv.appendChild(messageDiv);

            if (typewriterEffect) {
                this.isTyping = true;
                this.typewriterText(messageDiv.querySelector('.typing-text'), text, () => {
                    this.isTyping = false;
                    this.appendBookingButton(messageDiv, bookingUrl);
                    this.elements.messagesDiv.scrollTop = this.elements.messagesDiv.scrollHeight;
                });
            } else {
                messageDiv.querySelector('.typing-text').textContent = text;
                this.appendBookingButton(messageDiv, bookingUrl);
            }

            this.elements.messagesDiv.scrollTop = this.elements.messagesDiv.scrollHeight;
        },

        appendUserMessage(text, imageDataUrl = null) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('apex-message', 'apex-user-message');
            if (imageDataUrl) {
                const img = document.createElement('img');
                img.src = imageDataUrl;
                img.classList.add('apex-chat-image');
                img.alt = 'Uploaded photo';
                messageDiv.appendChild(img);
            }
            if (text) {
                const textSpan = document.createElement('span');
                textSpan.textContent = text;
                messageDiv.appendChild(textSpan);
            }
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
            const messagesDiv = this.elements.messagesDiv;

            const type = () => {
                if (index < text.length) {
                    element.textContent += text[index];
                    index++;
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
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

        setImageProcessing(isProcessing) {
            this.imageIsProcessing = isProcessing;

            if (this.elements && this.elements.sendBtn) {
                this.elements.sendBtn.disabled = !!isProcessing;
            }
        },

        waitForImageProcessing() {
            if (!this.imageProcessingPromise) {
                return Promise.resolve();
            }

            return this.imageProcessingPromise.catch((err) => {
                console.warn('[ApexWidget] Image processing did not complete successfully before send', err);
            });
        },

        compressImage(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 640;
                            const targetWidth = Math.min(MAX_WIDTH, img.width || MAX_WIDTH);
                            const scaleSize = targetWidth / (img.width || targetWidth);
                            const targetHeight = Math.max(1, Math.round((img.height || targetWidth) * scaleSize));

                            canvas.width = targetWidth;
                            canvas.height = targetHeight;

                            const ctx = canvas.getContext('2d');
                            if (!ctx) {
                                reject(new Error('Failed to get image canvas context'));
                                return;
                            }

                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
                            resolve(compressedBase64);
                        } catch (error) {
                            reject(error);
                        }
                    };

                    img.onerror = () => {
                        reject(new Error('Failed to decode uploaded image'));
                    };

                    img.src = event.target.result;
                };

                reader.onerror = () => {
                    reject(reader.error || new Error('Failed to read image file'));
                };

                reader.readAsDataURL(file);
            });
        },

        handleImageUpload(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
                this.appendBotMessage('Please upload an image file.', false);
                return;
            }

            // Validate file size (allow larger originals; image is compressed before send)
            if (file.size > 20 * 1024 * 1024) {
                this.appendBotMessage('Image is too large. Please choose one under 20MB.', false);
                return;
            }

            const uploadToken = ++this.imageUploadToken;
            this.setImageProcessing(true);

            this.imageProcessingPromise = this.compressImage(file)
                .then((dataUrl) => {
                    if (uploadToken !== this.imageUploadToken) {
                        return;
                    }

                    this.elements.imageDataHolder.dataset.imageBase64 = dataUrl;
                    this.elements.imageDataHolder.dataset.imageType = 'image/jpeg';

                    this.elements.imagePreview.style.backgroundImage = `url('${dataUrl}')`;
                    this.elements.imageUploadWrapper.style.display = 'none';
                    this.elements.imagePreviewWrapper.style.display = 'flex';

                    const parsed = this.parseImageDataUrl(dataUrl, 'image/jpeg');
                    if (!parsed) {
                        console.warn('[ApexWidget] Compressed image data URL appears malformed');
                    } else {
                        const MAX_SENT_BYTES = 500 * 1024; // 500 KB hard cap on compressed output
                        const originalBytes = Number(file.size || 0);
                        const compressedBytes = Number(parsed.estimatedBytes || 0);

                        if (compressedBytes > MAX_SENT_BYTES) {
                            this.appendBotMessage(
                                `That image is still too large after compression (${Math.round(compressedBytes / 1024)} KB). Please use a smaller or lower-resolution photo.`,
                                false
                            );
                            this.removeImage();
                            return;
                        }

                        const savedBytes = Math.max(0, originalBytes - compressedBytes);
                        const reductionPercent = originalBytes > 0
                            ? Number(((savedBytes / originalBytes) * 100).toFixed(1))
                            : 0;

                        console.log('[ApexWidget] Compressed image payload prepared:', {
                            original_size_bytes: originalBytes,
                            compressed_size_bytes: compressedBytes,
                            saved_bytes: savedBytes,
                            reduction_percent: reductionPercent,
                            original_mime_type: file.type,
                            mime_type: parsed.mimeType,
                            base64_length: parsed.base64.length,
                            estimated_bytes: parsed.estimatedBytes
                        });
                    }
                })
                .catch((err) => {
                    if (uploadToken === this.imageUploadToken) {
                        this.appendBotMessage('There was a problem processing that image. Please try again.', false);
                        this.removeImage();
                    }
                    throw err;
                })
                .finally(() => {
                    if (uploadToken === this.imageUploadToken) {
                        this.setImageProcessing(false);
                        this.imageProcessingPromise = null;
                    }
                });
        },

        parseImageDataUrl(dataUrl, fallbackMimeType = '') {
            if (!dataUrl || typeof dataUrl !== 'string') return null;

            const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
            if (!match) return null;

            const mimeType = (match[1] || fallbackMimeType || '').toLowerCase();
            const base64 = (match[2] || '').replace(/\s+/g, '');
            if (!base64) return null;

            const estimatedBytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0));

            return {
                dataUrl,
                base64,
                mimeType,
                estimatedBytes
            };
        },

        getImageFileExtension(mimeType) {
            if (!mimeType || typeof mimeType !== 'string') return 'jpg';

            if (mimeType.includes('png')) return 'png';
            if (mimeType.includes('webp')) return 'webp';
            if (mimeType.includes('gif')) return 'gif';
            return 'jpg';
        },

        base64ToBlob(base64, mimeType) {
            if (!base64 || typeof base64 !== 'string') return null;

            try {
                const clean = base64.replace(/\s+/g, '');
                const binary = atob(clean);
                const length = binary.length;
                const bytes = new Uint8Array(length);

                for (let i = 0; i < length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }

                return new Blob([bytes], { type: mimeType || 'image/jpeg' });
            } catch (error) {
                console.warn('[ApexWidget] Failed to convert base64 image to blob', error);
                return null;
            }
        },

        buildMultipartPayload(payload, parsedImage) {
            const formData = new FormData();

            // Keep the original JSON contract available to backend parsers.
            formData.append('payload_json', JSON.stringify(payload));

            // Also include common fields directly for simpler n8n mapping.
            formData.append('message', payload.message || '');
            formData.append('message_inquiry', String(payload.message_inquiry || ''));
            formData.append('shop_id', String(payload.shop_id || ''));
            formData.append('session_id', payload.session_id || '');
            formData.append('vehicle_mileage', String(payload.vehicle_mileage || 0));
            formData.append('vehicle_json', JSON.stringify(payload.vehicle || {}));
            formData.append('contact_json', JSON.stringify(payload.contact || {}));
            formData.append('image_present', String(!!parsedImage));

            if (parsedImage && parsedImage.base64) {
                const imageBlob = this.base64ToBlob(parsedImage.base64, parsedImage.mimeType);
                const ext = this.getImageFileExtension(parsedImage.mimeType);

                if (imageBlob && imageBlob.size > 0) {
                    formData.append('image_file', imageBlob, `upload.${ext}`);
                }

                formData.append('image_mime_type', parsedImage.mimeType || 'image/jpeg');
                formData.append('image_estimated_bytes', String(parsedImage.estimatedBytes || 0));
            }

            return formData;
        },

        formatMileage(value) {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isFinite(parsed)) return '0 mi';
            return `${parsed.toLocaleString('en-US')} mi`;
        },

        updateMileageUI() {
            const slider = this.elements.mileageRange;
            const label = this.elements.mileageValue;
            if (!slider) return;

            const min = Number.parseInt(slider.min, 10) || 0;
            const max = Number.parseInt(slider.max, 10) || 200000;
            const value = Number.parseInt(slider.value, 10) || 0;
            const ratio = max > min ? ((value - min) / (max - min)) : 0;
            const progress = Math.max(0, Math.min(100, ratio * 100));
            const sliderWidth = slider.getBoundingClientRect().width || 1;
            const thumbWidth = 24;
            const visualProgress = ratio <= 0
                ? 0
                : Math.max(
                    0,
                    Math.min(
                        100,
                        ((((sliderWidth - thumbWidth) * ratio) + (thumbWidth / 2)) / sliderWidth) * 100
                    )
                );

            slider.style.setProperty('--apex-mileage-progress', `${progress}%`);
            slider.style.setProperty('--apex-mileage-visual-progress', `${visualProgress}%`);
            if (label) {
                label.textContent = this.formatMileage(value);
            }
        },

        removeImage() {
            this.imageUploadToken += 1;
            this.imageProcessingPromise = null;
            this.setImageProcessing(false);
            this.elements.imageDataHolder.dataset.imageBase64 = '';
            this.elements.imageDataHolder.dataset.imageType = '';
            this.elements.imagePreview.style.backgroundImage = '';
            if (this.elements.cameraInput) this.elements.cameraInput.value = '';
            if (this.elements.galleryInput) this.elements.galleryInput.value = '';
            this.elements.imageUploadWrapper.style.display = 'flex';
            this.elements.imagePreviewWrapper.style.display = 'none';
        },

        applyTestData() {
            const nowYear = new Date().getFullYear();
            const fallbackYear = String(Math.min(Math.max(2005, nowYear), 2025));
            const preferredMake = 'Honda';
            const preferredModel = 'Civic';

            if (this.elements.contactName) this.elements.contactName.value = 'Test Customer';
            if (this.elements.contactPhone) this.elements.contactPhone.value = '5551234567';

            if (this.elements.contactConsent) {
                this.elements.contactConsent.checked = true;
            }
            if (this.elements.contactConsentError) {
                this.elements.contactConsentError.style.display = 'none';
            }

            if (this.elements.mileageRange) {
                this.elements.mileageRange.value = '75000';
                this.updateMileageUI();
            }

            if (this.elements.yearSelect) {
                this.elements.yearSelect.value = fallbackYear;
            }

            if (this.elements.makeSelect) {
                this.elements.makeSelect.value = preferredMake;
                this.onMakeChange();
            }

            const selectModel = () => {
                const modelSelect = this.elements.modelSelect;
                if (!modelSelect || !modelSelect.options || !modelSelect.options.length) return;

                const preferredOption = Array.from(modelSelect.options).find(
                    (opt) => (opt.value || '').toLowerCase() === preferredModel.toLowerCase()
                );

                if (preferredOption) {
                    modelSelect.value = preferredOption.value;
                    return;
                }

                const firstReal = Array.from(modelSelect.options).find((opt) => !!opt.value);
                if (firstReal) modelSelect.value = firstReal.value;
            };

            setTimeout(selectModel, 80);
            setTimeout(selectModel, 280);

            if (this.elements.inputField && !this.elements.inputField.value.trim()) {
                this.elements.inputField.value = 'My car is making a clicking noise when turning and the check engine light is on.';
            }

            if (this.elements.inputField) {
                this.elements.inputField.focus();
            }
        },

        async sendMessage() {
            const text = this.elements.inputField.value.trim();
            const name = this.elements.contactName.value.trim();
            const phone = this.elements.contactPhone.value.trim();
            const hasConsent = !!(this.elements.contactConsent && this.elements.contactConsent.checked);
            
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

            if (!hasConsent) {
                if (this.elements.contactConsentError) {
                    this.elements.contactConsentError.style.display = 'block';
                }
                return;
            }

            await this.waitForImageProcessing();

            this.elements.inputField.value = '';
            this.elements.inputField.disabled = true;
            this.elements.sendBtn.disabled = true;

            // Get image data if available (must be before appendUserMessage so thumbnail shows)
            const imageBase64 = this.elements.imageDataHolder.dataset.imageBase64 || '';
            const imageType = this.elements.imageDataHolder.dataset.imageType || '';
            const parsedImage = imageBase64 ? this.parseImageDataUrl(imageBase64, imageType) : null;

            this.appendUserMessage(text, imageBase64 || null);
            this.appendTypingIndicator();

            this.elements.vehicleWrap.classList.add('select-hidden');

            this.messageCount = (this.messageCount || 0) + 1;
            const messageInquiry = this.messageCount;

            const payload = {
                message: text,
                message_inquiry: messageInquiry,
                shop_id: this.SHOP_ID,
                session_id: this.SESSION_ID,
                vehicle_mileage: Number.parseInt(this.elements.mileageRange?.value || '0', 10) || 0,
                vehicle: {
                    year: this.elements.yearSelect.value || null,
                    make: this.elements.makeSelect.value || null,
                    model: this.elements.modelSelect.value || null
                },
                contact: {
                    name: name,
                    phone: phone,
                    sms_consent: true
                },
                image_present: !!parsedImage,
                image_base64: parsedImage ? parsedImage.base64 : null,
                image_mime_type: parsedImage ? parsedImage.mimeType : null,
                image_data_url: parsedImage ? parsedImage.dataUrl : null,
                image_estimated_bytes: parsedImage ? parsedImage.estimatedBytes : null
            };

            if (imageBase64 && !parsedImage) {
                console.warn('[ApexWidget] Image was selected but payload format is invalid; sending without image');
            }

            const self = this;
            const useMultipartForImage = !!parsedImage && (
                this.IMAGE_TRANSPORT === 'binary' ||
                this.IMAGE_TRANSPORT === 'multipart' ||
                this.IMAGE_TRANSPORT === 'file'
            );

            const requestOptions = useMultipartForImage
                ? {
                    method: 'POST',
                    body: this.buildMultipartPayload(payload, parsedImage)
                }
                : {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                };

            console.log('[ApexWidget] Sending payload to n8n:', payload);
            console.log('[ApexWidget] Webhook URL:', this.N8N_WEBHOOK_URL);
            console.log('[ApexWidget] Image transport mode:', useMultipartForImage ? 'multipart-binary' : 'json-base64');
            
            fetch(this.N8N_WEBHOOK_URL, requestOptions)
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
                const bookingUrl = self.normalizeBookingUrl(data.booking_url || data.bookingUrl || null);
                if (message && typeof message === 'string') {
                    self.appendBotMessage(message, true, bookingUrl);
                } else {
                    // If no proper message, show generic success
                    self.appendBotMessage("Thanks! We've received your request and will get back to you shortly.", true, bookingUrl);
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
                    bottom: calc(24px + env(safe-area-inset-bottom, 0px));
                    right: calc(24px + env(safe-area-inset-right, 0px));
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
                    bottom: calc(100px + env(safe-area-inset-bottom, 0px));
                    right: calc(24px + env(safe-area-inset-right, 0px));
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
                    bottom: calc(100px + env(safe-area-inset-bottom, 0px));
                    right: calc(24px + env(safe-area-inset-right, 0px));
                    width: min(400px, calc(100vw - 32px - env(safe-area-inset-right, 0px)));
                    height: min(760px, calc(100vh - 120px - env(safe-area-inset-bottom, 0px)));
                    height: min(760px, calc(100dvh - 120px - env(safe-area-inset-bottom, 0px)));
                    background: var(--apex-dark);
                    border-radius: 16px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    overscroll-behavior: contain;
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

                .apex-build-version-pill {
                    align-self: flex-start;
                    margin-top: 2px;
                    padding: 4px 8px;
                    border-radius: 999px;
                    border: 1px solid rgba(255, 255, 255, 0.32);
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.1) 100%);
                    color: rgba(255, 255, 255, 0.96);
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 0.45px;
                    text-transform: uppercase;
                    white-space: nowrap;
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 4px 12px rgba(15, 23, 42, 0.28);
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
                    overscroll-behavior: contain;
                    -webkit-overflow-scrolling: touch;
                    touch-action: pan-y;
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
                .apex-user-message .apex-chat-image { display: block; max-width: 100%; max-height: 180px; width: auto; border-radius: 8px; margin-bottom: 6px; object-fit: contain; }
                .apex-user-message span { display: block; }

                .apex-bot-message .typing-text {
                    display: block;
                    white-space: pre-wrap;
                }

                .apex-booking-link {
                    margin-top: 10px;
                    width: 100%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 11px 14px;
                    border-radius: 12px;
                    border: 1px solid rgba(147, 197, 253, 0.45);
                    background: linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%);
                    color: #ffffff;
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.2px;
                    text-decoration: none;
                    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.32);
                    transition: transform 150ms ease, box-shadow 150ms ease, filter 150ms ease;
                }

                .apex-booking-link:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.4);
                    filter: brightness(1.03);
                }

                .apex-booking-link:active {
                    transform: translateY(0);
                }

                .apex-booking-link:focus-visible {
                    outline: 2px solid #bfdbfe;
                    outline-offset: 2px;
                }

                .apex-booking-icon {
                    font-size: 14px;
                    line-height: 1;
                }

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

                .apex-typing-text-wrapper { min-width: 0; display: flex; align-items: center; transition: opacity 450ms ease; }
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
                    min-width: 0;
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

                #apex-test-fill-btn {
                    position: absolute;
                    bottom: 6px;
                    left: 6px;
                    z-index: 10;
                    background: rgba(37, 99, 235, 0.18);
                    color: #bfdbfe;
                    border: 1px solid rgba(147, 197, 253, 0.35);
                    border-radius: 8px;
                    width: 24px;
                    height: 18px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                    opacity: 0.55;
                    transition: opacity 150ms ease, transform 150ms ease;
                    padding: 0;
                    line-height: 1;
                }

                #apex-test-fill-btn:hover {
                    opacity: 1;
                    transform: scale(1.08);
                }

                #apex-test-fill-btn:active {
                    transform: scale(0.95);
                }

                #apex-image-upload-wrapper {
                    display: flex;
                    gap: 8px;
                }

                #apex-image-btn-camera,
                #apex-image-btn-gallery {
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

                #apex-image-btn-camera svg,
                #apex-image-btn-gallery svg { width: 20px; height: 20px; }
                #apex-image-btn-camera:hover,
                #apex-image-btn-gallery:hover { transform: scale(1.05); border-color: var(--apex-blue); color: var(--apex-blue); }
                #apex-image-btn-camera:active,
                #apex-image-btn-gallery:active { transform: scale(0.95); }

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
                    overflow-y: auto;
                    -webkit-overflow-scrolling: touch;
                    overscroll-behavior: contain;
                    position: relative;
                }

                #apex-form-scroll-hint {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1px;
                    padding: 10px 0 8px;
                    pointer-events: none;
                    background: linear-gradient(to bottom, transparent 0%, var(--apex-dark) 55%);
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.5s ease;
                    z-index: 5;
                    color: var(--apex-blue);
                }

                #apex-form-scroll-hint.visible {
                    opacity: 1;
                    visibility: visible;
                    animation: apex-hint-bounce 0.9s ease-in-out infinite;
                }

                @keyframes apex-hint-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(5px); }
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

                .apex-mileage-row {
                    flex-direction: column;
                    gap: 9px;
                    padding: 8px 10px;
                    border: 1px solid rgba(148, 163, 184, 0.22);
                    border-radius: 12px;
                    background: radial-gradient(circle at 18% 0%, rgba(96, 165, 250, 0.1) 0%, rgba(15, 23, 42, 0.18) 48%, rgba(15, 23, 42, 0.08) 100%);
                    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 10px 20px rgba(2, 6, 23, 0.2);
                }

                .apex-mileage-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    font-size: 12px;
                    color: var(--apex-text-muted);
                    letter-spacing: 0.2px;
                }

                .apex-mileage-label {
                    color: var(--apex-text-muted);
                    font-weight: 500;
                }

                .apex-mileage-value {
                    color: var(--apex-text);
                    font-weight: 600;
                    font-variant-numeric: tabular-nums;
                    text-shadow: 0 0 12px rgba(96, 165, 250, 0.25);
                }

                .apex-mileage-range {
                    appearance: none;
                    -webkit-appearance: none;
                    width: 100%;
                    height: 12px;
                    border-radius: 999px;
                    border: 1px solid rgba(148, 163, 184, 0.35);
                    background:
                        linear-gradient(90deg, #2563eb 0%, #3b82f6 45%, #60a5fa 100%) 0 0 / var(--apex-mileage-visual-progress, 0%) 100% no-repeat,
                        linear-gradient(90deg, rgba(148, 163, 184, 0.3) 0%, rgba(148, 163, 184, 0.16) 100%) 0 0 / 100% 100% no-repeat;
                    transition: background 120ms linear, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
                    cursor: pointer;
                    outline: none;
                    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.45), 0 1px 0 rgba(255, 255, 255, 0.06);
                }

                .apex-mileage-range:hover {
                    border-color: var(--apex-blue);
                    transform: translateY(-0.5px);
                }

                .apex-mileage-range:focus {
                    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.45), 0 0 0 3px rgba(59, 130, 246, 0.18), 0 0 18px rgba(59, 130, 246, 0.22);
                }

                .apex-mileage-range::-webkit-slider-runnable-track {
                    height: 12px;
                    background: transparent;
                    border-radius: 999px;
                }

                .apex-mileage-range::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: 2px solid rgba(255, 255, 255, 0.88);
                    background: radial-gradient(circle at 28% 25%, #ffffff 0%, #dbeafe 20%, #60a5fa 44%, #2563eb 100%);
                    box-shadow: 0 6px 14px rgba(37, 99, 235, 0.5), 0 0 0 2px rgba(59, 130, 246, 0.25);
                    margin-top: -7px;
                    transition: transform 120ms ease, box-shadow 120ms ease;
                }

                .apex-mileage-range:active::-webkit-slider-thumb {
                    transform: scale(1.1);
                    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.58), 0 0 0 4px rgba(59, 130, 246, 0.28);
                }

                .apex-mileage-range.is-dragging {
                    border-color: #60a5fa;
                    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.45), 0 0 0 3px rgba(59, 130, 246, 0.2), 0 0 20px rgba(59, 130, 246, 0.3);
                }

                .apex-mileage-range::-moz-range-track {
                    height: 12px;
                    border-radius: 999px;
                    background: linear-gradient(90deg, rgba(148, 163, 184, 0.3) 0%, rgba(148, 163, 184, 0.16) 100%);
                    border: none;
                }

                .apex-mileage-range::-moz-range-progress {
                    height: 12px;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #2563eb 0%, #3b82f6 45%, #60a5fa 100%);
                }

                .apex-mileage-range::-moz-range-thumb {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: 2px solid rgba(255, 255, 255, 0.88);
                    background: radial-gradient(circle at 28% 25%, #ffffff 0%, #dbeafe 20%, #60a5fa 44%, #2563eb 100%);
                    box-shadow: 0 6px 14px rgba(37, 99, 235, 0.5), 0 0 0 2px rgba(59, 130, 246, 0.25);
                    transition: transform 120ms ease, box-shadow 120ms ease;
                    cursor: pointer;
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

                .apex-consent-wrap {
                    margin-top: 2px;
                    padding: 8px 10px;
                    border: 1px solid rgba(148, 163, 184, 0.24);
                    border-radius: 10px;
                    background: rgba(15, 23, 42, 0.45);
                }

                .apex-consent-label {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    font-size: 11px;
                    line-height: 1.45;
                    color: rgba(226, 232, 240, 0.92);
                    cursor: pointer;
                }

                .apex-consent-label a {
                    color: #93c5fd;
                    text-decoration: underline;
                    text-underline-offset: 2px;
                }

                .apex-consent-label a:hover {
                    color: #dbeafe;
                }

                .apex-consent-checkbox {
                    margin-top: 2px;
                    width: 14px;
                    height: 14px;
                    accent-color: var(--apex-blue);
                    flex-shrink: 0;
                }

                .apex-consent-error {
                    display: none;
                    margin-top: 6px;
                    font-size: 11px;
                    line-height: 1.35;
                    color: #fca5a5;
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

                @media (max-width: 768px) {
                    #apex-chat-button {
                        width: 56px;
                        height: 56px;
                        right: calc(12px + env(safe-area-inset-right, 0px));
                        bottom: calc(12px + env(safe-area-inset-bottom, 0px));
                    }

                    #apex-proactive-greeting {
                        right: calc(8px + env(safe-area-inset-right, 0px));
                        bottom: calc(88px + env(safe-area-inset-bottom, 0px));
                        max-width: min(280px, calc(100vw - 24px));
                    }

                    #apex-chat-window {
                        right: calc(8px + env(safe-area-inset-right, 0px));
                        bottom: calc(76px + env(safe-area-inset-bottom, 0px));
                        width: calc(100vw - 16px - env(safe-area-inset-right, 0px));
                        height: min(86vh, calc(var(--apex-runtime-vh, 100dvh) - 88px));
                        height: min(86dvh, calc(var(--apex-runtime-vh, 100dvh) - 88px));
                        border-radius: 14px;
                    }

                    .apex-form-row-split {
                        flex-direction: column;
                    }

                    .apex-input,
                    .apex-select,
                    #apex-chat-input {
                        font-size: 16px;
                    }

                    .apex-mileage-header {
                        font-size: 13px;
                    }

                    #apex-chat-input-area {
                        padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
                    }
                }

                @media (max-width: 430px) {
                    #apex-chat-window {
                        top: calc(env(safe-area-inset-top, 0px) + 8px);
                        left: 8px;
                        right: 8px;
                        bottom: calc(8px + env(safe-area-inset-bottom, 0px));
                        width: auto;
                        height: auto;
                        border-radius: 18px;
                        border: 1px solid var(--apex-border);
                        transform-origin: bottom center;
                    }

                    #apex-proactive-greeting {
                        display: none;
                    }

                    #apex-chat-header {
                        gap: 10px;
                        padding: 14px;
                        padding-top: calc(14px + env(safe-area-inset-top, 0px));
                    }

                    #apex-avatar {
                        width: 32px;
                        height: 32px;
                    }

                    #apex-header-title {
                        font-size: 15px;
                    }

                    #apex-header-subtitle,
                    #apex-header-model {
                        font-size: 11px;
                    }

                    .apex-form-section {
                        gap: 8px;
                        max-height: 236px;
                        overflow-y: auto;
                        flex-shrink: 0;
                    }

                    .apex-form-disclaimer {
                        font-size: 10px;
                        margin-top: 4px;
                    }

                    .apex-input,
                    .apex-select {
                        padding: 10px 12px;
                        font-size: 16px;
                    }

                    .apex-mileage-row {
                        gap: 6px;
                    }

                    #apex-chat-input-area {
                        padding: 10px;
                        gap: 8px;
                        align-items: center;
                        padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
                    }

                    #apex-chat-input {
                        padding: 9px 10px;
                        font-size: 15px;
                    }

                    #apex-image-btn-camera,
                    #apex-image-btn-gallery,
                    #apex-send-btn {
                        width: 40px;
                        height: 40px;
                        border-radius: 10px;
                    }

                    #apex-image-preview {
                        width: 40px;
                        height: 40px;
                    }

                    .apex-message,
                    .apex-typing-bubble {
                        max-width: 92%;
                    }
                }
            `;
        }
    };
})();

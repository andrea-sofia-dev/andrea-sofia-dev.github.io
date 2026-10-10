// Everything the 3D scene shows, plus the Italian translation of the page.
// The English text lives in index.html, so the page reads fine before (and without) JavaScript.

export const nodes = [
  { id: 'wp-doctor', label: 'wp-doctor', color: 0x38e1ff, shape: 'icosahedron' },
  { id: 'case-study', label: 'case-study', color: 0xa78bfa, shape: 'octahedron' },
  { id: 'this-site', label: 'this-site', color: 0x5cf2b0, shape: 'dodecahedron' },
];

export const skills = [
  'Claude Code', 'MCP', 'Claude API', 'WordPress', 'PHP', 'JavaScript', 'Node.js', 'Three.js',
  'Moodle', 'MySQL', 'Redis', 'Cloudflare', 'GA4 · GTM', 'Linux', 'Git', 'Python',
];

// The session typed on the 3D terminal. Same story as the case study.
export const terminalScripts = {
  en: [
    { type: 'cmd', text: 'claude' },
    { type: 'user', text: "Make the homepage faster. Don't change the design." },
    { type: 'step', text: 'Measuring… TTFB 2.9 s, visitors with a cookie skip the cache' },
    { type: 'step', text: 'Plan: cache every visitor except logged-in users' },
    { type: 'ok', text: "Syntax checked on the server's PHP version" },
    { type: 'ok', text: 'Backup saved · rollback ready' },
    { type: 'ok', text: 'Deployed · TTFB 0.8 s · cache HIT' },
    { type: 'ok', text: 'Checked in the browser · no new console errors' },
    { type: 'cmd', text: 'npx github:andrea-sofia-dev/wp-doctor example.com' },
    { type: 'ok', text: 'Page cache: HIT for visitors with a cookie' },
    { type: 'ok', text: 'Compression: br' },
    { type: 'dim', text: '3 passed · 0 warnings · 0 failed' },
  ],
  it: [
    { type: 'cmd', text: 'claude' },
    { type: 'user', text: 'Rendi la home più veloce. Senza cambiare la grafica.' },
    { type: 'step', text: 'Misuro… TTFB 2,9 s, chi ha un cookie salta la cache' },
    { type: 'step', text: 'Piano: cache per tutti tranne gli utenti collegati' },
    { type: 'ok', text: 'Sintassi controllata sulla versione PHP del server' },
    { type: 'ok', text: 'Backup salvato · ripristino pronto' },
    { type: 'ok', text: 'Pubblicato · TTFB 0,8 s · cache HIT' },
    { type: 'ok', text: 'Controllato nel browser · nessun nuovo errore' },
    { type: 'cmd', text: 'npx github:andrea-sofia-dev/wp-doctor example.com' },
    { type: 'ok', text: 'Cache della pagina: HIT anche con un cookie' },
    { type: 'ok', text: 'Compressione: br' },
    { type: 'dim', text: '3 superati · 0 avvisi · 0 falliti' },
  ],
};

export const it = {
  'meta.title': 'Andrea Sofia · Full Stack Web Developer',
  skip: 'Vai al contenuto',
  'nav.how': 'Come lavoro',
  'nav.projects': 'Progetti',
  'nav.stack': 'Competenze',
  'nav.contact': 'Contatti',

  'hero.lead':
    "Costruisco e gestisco siti in produzione con gli agenti IA. L'agente scrive, prova e pubblica il codice; io fisso le regole, controllo ogni rilascio e rispondo di quello che va online.",
  'hero.cta': 'Guarda i progetti',
  'hero.meta': 'Roma · Web developer a Università.it',
  'hero.scroll': 'scorri',

  'how.kicker': 'Come lavoro',
  'how.title': "Sviluppo agentico, con un umano al comando",
  'how.intro':
    "Lavoro ogni giorno con Claude Code. L'agente scrive; io decido l'architettura, le regole e il risultato.",
  'how.s1.t': 'Fissare le regole',
  'how.s1.d':
    "Obiettivo, limiti e cose che l'agente non deve mai toccare, scritti nel progetto prima di qualsiasi codice.",
  'how.s2.t': 'Costruire',
  'how.s2.d':
    "L'agente legge il codice, scrive la modifica e usa gli strumenti: test, linter, la stessa versione di PHP del server.",
  'how.s3.t': 'Verificare',
  'how.s3.d':
    'Prima e dopo ogni rilascio: backup, controllo della sintassi, pagine dal vivo, console del browser, log degli errori.',
  'how.s4.t': 'Rilasciare a piccoli passi',
  'how.s4.d':
    'Un passo per volta, con il comando di ripristino pronto. Se qualcosa non torna, si ferma e chiede.',

  'projects.kicker': 'Progetti',
  'projects.title': 'Cose che ho costruito in pubblico',
  'p.wpd.tag': 'CLI · MCP',
  'p.wpd.d':
    'PageSpeed ti dice che il server è lento; wp-doctor ti dice perché, e se i visitatori veri prendono la cache: con il cookie del consenso, con i parametri utm_*, dal telefono.',
  'p.wpd.b1': "Server MCP: un agente IA lancia i controlli e propone le correzioni per il tuo stack",
  'p.wpd.b2': 'Riconosce Cloudflare, Fastly, Varnish, LiteSpeed e i principali plugin di cache di WordPress',
  'p.wpd.b3': 'Zero dipendenze · risultato nel terminale, in JSON o in un report HTML',
  copy: 'Copia',
  copied: 'Copiato',
  'p.cs.title': 'Caso di studio: prestazioni WordPress',
  'p.cs.tag': 'Racconto',
  'p.cs.d':
    'Come ho reso 3 volte più veloce un portale WordPress + Divi su hosting condiviso, senza cambiare grafica, tema o hosting.',
  'p.cs.s1': 'Risposta del server',
  'p.cs.s1.before': '2,9 s →',
  'p.cs.s1.after': '0,8 s',
  'p.cs.s2': 'Lighthouse mobile',
  'p.cs.s3': 'LCP (mobile)',
  'p.cs.s3.before': '16–20 s →',
  'p.cs.s3.after': '~4 s',
  'p.site.title': 'Questo sito',
  'p.site.d':
    'Un portfolio 3D in JavaScript semplice: Three.js e Vite, nessun framework, nessun cookie, nessun tracciamento. Costruito in modo agentico con Claude Code, dalla prima riga al deploy.',
  'p.site.b1': 'Prima il testo: la pagina si legge prima che arrivi il 3D, e anche senza WebGL',
  'p.site.b2': 'Rispetta la riduzione del movimento; abbassa la qualità sui dispositivi lenti',
  'more.title': 'Altri progetti',
  'more.note': 'Elenco aggiornato in automatico dal mio GitHub.',
  'more.demo': 'Demo online',

  'stack.kicker': 'Di cosa mi occupo',
  'stack.title': 'Dal plugin al server',
  'stack.intro': 'Seguo cinque portali universitari italiani da cima a fondo. Ecco cosa vuol dire:',
  'stack.a1.t': 'WordPress su misura',
  'stack.a1.d': 'Plugin e temi figli in PHP e JavaScript, Contact Form 7, Divi.',
  'stack.a2.t': 'Funzioni IA',
  'stack.a2.d': "Chatbot e tutor basati sull'API di Claude; server MCP per gli agenti.",
  'stack.a3.t': 'Integrazioni',
  'stack.a3.d': 'CRM via API REST, email marketing, Google Sheets, code di nuovi tentativi per i form.',
  'stack.a4.t': 'E-learning',
  'stack.a4.d': 'Piattaforme Moodle con plugin, temi su misura e un tutor IA.',
  'stack.a5.t': 'Sicurezza e prestazioni',
  'stack.a5.d': 'WAF e cache di Cloudflare, Redis, Core Web Vitals.',
  'stack.a6.t': 'Tracciamento e privacy',
  'stack.a6.d': 'GTM, GA4, eventi lato server e gestione del consenso GDPR.',
  'stack.tools': 'Strumenti',

  'contact.kicker': 'Contatti',
  'contact.title': 'Parliamone',
  'contact.d':
    'Domande sullo sviluppo agentico, su WordPress o sulle integrazioni IA? Scrivimi su LinkedIn.',

  'footer.built': 'Fatto con Three.js e Claude Code',
  'footer.privacy': 'Nessun cookie, nessun tracciamento',
  'footer.source': 'Codice sorgente',
};

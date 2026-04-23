import './style.css';

interface ChromeLanguageModelOptions extends LanguageModelCreateOptions {
  expectedOutputLanguages?: string[];
}

const LANG_OPTIONS: ChromeLanguageModelOptions = {
  expectedOutputLanguages: ['en'],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

// ---- Persona --------------------------------------------------------------- //

const PERSONA = {
  'First name':    'Jane',
  'Last name':     'Smith',
  'Email':         'jane.smith@example.com',
  'Phone':         '555-0142',
  'Address':       '12 Oak Avenue',
  'City':          'Portland',
  'State':         'OR',
  'ZIP':           '97201',
  'Card number':   '4111 1111 1111 1111',
  'Card expiry':   '12/28',
  'Card CVV':      '123',
  'Card name':     'Jane Smith',
  'Password':      'Demo@12345',
};

// ---- DOM ------------------------------------------------------------------- //

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="header">
    <h1>Local AI Autofill</h1>
    <p>Uses Chrome built-in AI to fill forms</p>
  </div>
  <div class="status-row">
    <span class="dot checking" id="dot"></span>
    <span class="status-text" id="status-text">Checking AI availability…</span>
  </div>
  <div class="progress-wrap hidden" id="progress-wrap">
    <div class="progress-bar" id="progress-bar"></div>
  </div>
  <dl class="persona">
    ${Object.entries(PERSONA).map(([label, value]) => `
      <div class="field-row">
        <dt>${label}</dt>
        <dd>${value}</dd>
      </div>
    `).join('')}
  </dl>
  <div class="body">
    <button id="autofill-btn" disabled>Autofill this page</button>
    <div class="log hidden" id="log">
      <span class="spinner hidden" id="spinner"></span>
      <span id="log-text"></span>
    </div>
  </div>
`;

const dot          = document.getElementById('dot')!;
const statusText   = document.getElementById('status-text')!;
const btn          = document.getElementById('autofill-btn') as HTMLButtonElement;
const logEl        = document.getElementById('log')!;
const spinner      = document.getElementById('spinner')!;
const logText      = document.getElementById('log-text')!;
const progressWrap = document.getElementById('progress-wrap')!;
const progressBar  = document.getElementById('progress-bar')!;


function setStatus(state: 'checking' | 'ready' | 'download' | 'error', text: string) {
  dot.className = `dot ${state}`;
  statusText.textContent = text;
}

function setLog(text: string, type: 'normal' | 'success' | 'error' = 'normal', loading = false) {
  logEl.className = `log${type !== 'normal' ? ` ${type}` : ''}`;
  logEl.classList.remove('hidden');
  logText.textContent = text;
  spinner.classList.toggle('hidden', !loading);
}

function clearLog() {
  logEl.classList.add('hidden');
}

function setProgress(pct: number | null) {
  if (pct === null) { progressWrap.classList.add('hidden'); return; }
  progressWrap.classList.remove('hidden');
  progressBar.style.width = `${pct}%`;
}

// ---- Availability check ---------------------------------------------------- //

async function checkAvailability(): Promise<Availability | 'missing'> {
  if (typeof LanguageModel === 'undefined') return 'missing';
  return LanguageModel.availability(LANG_OPTIONS);
}

checkAvailability().then(status => {
  console.log('[autofill] LanguageModel.availability():', status);
  if (status === 'missing' || status === 'unavailable') {
    setStatus('error', 'Built-in AI not available');
    setLog(
      status === 'missing'
        ? 'Enable chrome://flags/#optimization-guide-on-device-model'
        : 'Model unavailable on this device',
      'error'
    );
  } else if (status === 'downloading' || status === 'downloadable') {
    setStatus('download', 'Downloading AI model…');
    setLog('Downloading Gemini Nano…', 'normal', true);
    setProgress(0);
    monitorDownload();
  } else {
    setStatus('ready', 'Built-in AI ready');
    clearLog();
    btn.disabled = false;
  }
});

// ---- Download monitor ------------------------------------------------------ //

async function monitorDownload() {
  try {
    const session = await LanguageModel.create({
      ...LANG_OPTIONS,
      monitor(m) {
        m.addEventListener('downloadprogress', (e: ProgressEvent) => {
          const pct = e.total > 0 ? Math.round((e.loaded / e.total) * 100) : null;
          const label = pct !== null ? `Downloading Gemini Nano… ${pct}%` : 'Downloading Gemini Nano…';
          console.log('[autofill] download progress:', e.loaded, '/', e.total, pct != null ? `${pct}%` : '');
          setStatus('download', label);
          setLog(label, 'normal', true);
          if (pct !== null) setProgress(pct);
        });
      },
    } as ChromeLanguageModelOptions);
    session.destroy();
    setProgress(null);
    setStatus('ready', 'Built-in AI ready');
    clearLog();
    btn.disabled = false;
  } catch (err) {
    setProgress(null);
    setStatus('error', 'Download failed');
    setLog(err instanceof Error ? err.message : 'Model download failed', 'error');
  }
}

// ---- Autofill flow --------------------------------------------------------- //

btn.addEventListener('click', async () => {
  btn.disabled = true;
  clearLog();

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found');

    setLog('Reading page…', 'normal', true);
    let htmlResponse: { html: string };
    try {
      htmlResponse = await browser.tabs.sendMessage(tab.id, { type: 'getFormHTML' });
    } catch {
      throw new Error('Could not reach page — try refreshing it');
    }

    if (!htmlResponse.html.trim()) throw new Error('No form content found on this page');

    setLog('Asking AI to map fields…', 'normal', true);

    const values = PERSONA;
    const prompt = `You are helping autofill a web form.

Here is the data to fill in:
${JSON.stringify(values, null, 2)}

Here is the form HTML from the page:
${htmlResponse.html}

Match each piece of data to the most appropriate form field.
Respond with ONLY a valid JSON object mapping CSS selectors to values.

Example: {"#email": "jane@example.com", "input[name='first_name']": "Jane"}`;

    let session: LanguageModel;
    try {
      session = await LanguageModel.create({ ...LANG_OPTIONS } as ChromeLanguageModelOptions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('service') || msg.toLowerCase().includes('not running')) {
        throw new Error('AI service is starting up — wait a moment and try again');
      }
      throw err;
    }

    let raw: string;
    try {
      raw = await session.prompt(prompt);
    } finally {
      session.destroy();
    }

    console.log('[autofill] raw AI response:', raw);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI returned no parseable JSON');

    const fieldValues = JSON.parse(jsonMatch[0]) as Record<string, string>;
    const count = Object.keys(fieldValues).length;
    if (!count) throw new Error('AI returned no field mappings');

    setLog('Filling fields…', 'normal', true);
    await browser.tabs.sendMessage(tab.id, { type: 'fillFields', values: fieldValues });

    setLog(`Filled ${count} field${count !== 1 ? 's' : ''}`, 'success');
  } catch (err) {
    setLog(err instanceof Error ? err.message : String(err), 'error');
  } finally {
    btn.disabled = false;
  }
});

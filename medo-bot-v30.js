// ============================================================
// 👑 ميدو الجوهري V30 — النسخة الملكية الموحدة
// V29 (التقسيم) + v26 (الإدارة/التحميل/العظمة) + V7 (المحاكاة/المطورين) + أوامر الملف الإضافي
// المتطلبات: npm i @whiskeysockets/baileys pino
// اختياري: ffmpeg (ملصقات/صوتيات) + yt-dlp (تحميل)
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const { execFile } = require('child_process');
const P = require('pino');

const BOT_NAME = 'ميدو الجوهري 👑 V30';
const BOT_STYLED = 'مِيُــᷢ͟͠ـ͜,𝑀ــ͢͡ـٖدؤ໑ اَُلٍجَـᬸــِــᷢ͟͠ـ͜,𝑀ــ͢͡ـٖᷢـؤ໑هرِيُ⁽ ͢ᵛᵎᵖ𓆩²⁰⁹𓆪';
const CHANNEL_URL = 'https://whatsapp.com/channel/0029VbCd8rT77qVLajK32i1k';
const CHANNEL_NAME = 'قناة ميدو الجوهري الرسمية';
const ENTRY_MESSAGE = `*_~_لسـت كـارف انـها اعـمالي 𝑿x~_*🥂⃢🥃
عمك _*𒁂𓄂ميدوــ𒅌 𒅒 𒅒 𒅒 𒅒 𒅒 𒅒 𒅒 𒅒 𒅒 𒅒 𒅒 𒁂𓄂آلجوهري ـ𒅌*_
~《 انتظر و استمتع بدخول الدبابه البشريه 》~
𒁂𓄂آلجوهري نسخه لن تتكرر🥱ـ𒅌`;

const CONFIG = {
    PHONE_NUMBER: '',                       // اتركه فاضي وهيسألك وقت التشغيل
    OWNERS: ['48699548767', '201122290610', '201001209061'],
    PREFIX: '.',
    AUTH_FOLDER: path.join(__dirname, 'auth_info_baileys'),
    DOWNLOAD_FOLDER: path.join(__dirname, 'downloads'),
    DB_FILE: path.join(__dirname, 'bot_data.json'),
    MAX_FILE_SIZE: '60M',
    MAX_PARALLEL_DOWNLOADS: 2,
    AUTO_REPLY_COOLDOWN: 20000,
    AZAMA_COOLDOWN: 15000,
    DEFAULT_LOCKED: false,                  // true = البوت مقفول للأونر في أي شات جديد
};
if (!fs.existsSync(CONFIG.DOWNLOAD_FOLDER)) fs.mkdirSync(CONFIG.DOWNLOAD_FOLDER, { recursive: true });
const START_TIME = Date.now();
let B = null, DL = null;                    // baileys module / downloadMediaMessage

// ======================= قاعدة البيانات =======================
let DB = { users: {}, marriage: {}, warns: {}, groups: {}, banned: {} };
try { Object.assign(DB, JSON.parse(fs.readFileSync(CONFIG.DB_FILE, 'utf8'))); } catch {}
for (const k of ['users', 'marriage', 'warns', 'groups', 'banned']) DB[k] = DB[k] || {};
let dirty = false;
const saveDB = () => { dirty = true; };
const flushDB = () => { try { fs.writeFileSync(CONFIG.DB_FILE, JSON.stringify(DB, null, 2)); dirty = false; } catch {} };
setInterval(() => { if (dirty) flushDB(); }, 10000);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushDB(); process.exit(0); });
process.on('unhandledRejection', (e) => console.log('⚠️', e?.message || e));
process.on('uncaughtException', (e) => console.log('⚠️', e?.message || e));
function getUser(n) { const u = (DB.users[n] ||= { money: 1000, xp: 0, lvl: 1 }); u.msgs ??= 0; u.lastDaily ??= 0; return u; }
const getChat = (jid) => (DB.groups[jid] ||= { antilink: false, antispam: false, welcome: true, botLocked: CONFIG.DEFAULT_LOCKED });

// ======================= أدوات مساعدة =======================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const rndNum = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const memo = (fn) => { let p; return () => (p ||= fn()); };
const cleanJid = (j) => (j ? String(j).split(':')[0].split('?')[0].trim() : '');
const numOf = (j) => cleanJid(j).split('@')[0].replace(/\D/g, '');
const sameUser = (a, b) => { if (!a || !b) return false; const x = numOf(a), y = numOf(b); return !!x && !!y && x === y; };
const isGroup = (j) => typeof j === 'string' && j.endsWith('@g.us');
const normAr = (s) => String(s || '').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim().toLowerCase();
const cooldowns = new Map();
const onCooldown = (k, ms) => { const now = Date.now(); if (now - (cooldowns.get(k) || 0) < ms) return true; cooldowns.set(k, now); return false; };
const LINK_REGEX = /(https?:\/\/[^\s]+|chat\.whatsapp\.com\/[A-Za-z0-9]+|wa\.me\/[^\s]+)/i;
const linkWarnings = new Map();
const addLinkWarning = (jid, u) => { const k = jid + ':' + u; const n = (linkWarnings.get(k) || 0) + 1; linkWarnings.set(k, n); return n; };
const resetLinkWarning = (jid, u) => linkWarnings.delete(jid + ':' + u);
const floodMap = new Map();
function checkFlood(jid, u) { const k = jid + ':' + u; const now = Date.now(); const arr = (floodMap.get(k) || []).filter((t) => now - t < 8000); arr.push(now); floodMap.set(k, arr); return arr.length; }
const fmtUptime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 86400)}ي ${Math.floor((s % 86400) / 3600)}س ${Math.floor((s % 3600) / 60)}د`; };

function unwrap(m) { let cur = m; for (let i = 0; i < 6 && cur; i++) { const inner = cur.ephemeralMessage?.message || cur.viewOnceMessage?.message || cur.viewOnceMessageV2?.message || cur.viewOnceMessageV2Extension?.message || cur.documentWithCaptionMessage?.message || cur.editedMessage?.message; if (!inner) break; cur = inner; } return cur; }
function getText(msg) { const m = unwrap(msg?.message); if (!m) return ''; return (m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || m.documentMessage?.caption || '').trim(); }
function getContextInfo(msg) { const m = unwrap(msg?.message); if (!m) return null; const holder = Object.values(m).find((v) => v && typeof v === 'object' && v.contextInfo); return holder?.contextInfo || null; }
function getSender(msg) { const k = msg?.key || {}; return k.participantAlt || k.participantPn || k.participant || msg?.participant || k.remoteJidAlt || k.senderPn || k.remoteJid || ''; }
function getTarget(msg) { const ctx = getContextInfo(msg); if (!ctx) return null; if (Array.isArray(ctx.mentionedJid) && ctx.mentionedJid.length) return ctx.mentionedJid[0]; return ctx.participant || null; }
function targetOf(msg, args) { const t = getTarget(msg); if (t) return t; const m = String(args || '').match(/\d{7,15}/); return m ? m[0] + '@s.whatsapp.net' : null; }
const isAdmin = (p) => !!p && (p.admin === 'admin' || p.admin === 'superadmin');
function findParticipant(group, jid) { if (!group || !jid || !Array.isArray(group.participants)) return null; return group.participants.find((p) => sameUser(p.id, jid) || sameUser(p.lid, jid) || (p.phoneNumber && sameUser(p.phoneNumber, jid))) || null; }
const isOwner = (jid) => !!jid && CONFIG.OWNERS.includes(numOf(jid));
const isOwnerParticipant = (p) => !!p && (isOwner(p.id) || isOwner(p.phoneNumber) || isOwner(p.lid));
const senderIsOwner = (group, sender) => isOwner(sender) || isOwnerParticipant(findParticipant(group, sender));
function findBot(group, sock) { if (!group || !Array.isArray(group.participants)) return null; const ids = [sock?.user?.id, sock?.user?.lid].filter(Boolean); return group.participants.find((p) => ids.some((id) => sameUser(p.id, id) || sameUser(p.lid, id))) || null; }
const botIsAdmin = (group, sock) => isAdmin(findBot(group, sock));
const canUseAdmin = (group, sender) => senderIsOwner(group, sender) || isAdmin(findParticipant(group, sender));
async function reactTo(sock, jid, msg, emoji) { try { await sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }); } catch {} }
async function sendText(sock, jid, text, extra) { try { return await sock.sendMessage(jid, { text, ...(extra || {}) }); } catch (e) { console.log(e?.message || e); return null; } }
const withFooter = (t) => `${t}\n\n👑 ${BOT_NAME}\n🔗 ${CHANNEL_NAME}\n${CHANNEL_URL}`;
async function getHiddenMentions(sock, jid) { try { if (!isGroup(jid)) return []; return (await sock.groupMetadata(jid)).participants.map((p) => p.id); } catch { return []; } }
const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a); }); });

function fetchUrl(url, timeoutMs = 30000, redirects = 3) {
    return new Promise((resolve) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) { res.resume(); return resolve(fetchUrl(new URL(res.headers.location, url).toString(), timeoutMs, redirects - 1)); }
            let data = ''; res.setEncoding('utf8'); res.on('data', (c) => (data += c)); res.on('end', () => resolve({ ok: res.statusCode === 200, body: data }));
        });
        req.on('error', () => resolve({ ok: false, body: '' }));
        req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, body: '' }); });
    });
}
function fetchBuffer(url, timeoutMs = 30000, redirects = 3) {
    return new Promise((resolve) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) { res.resume(); return resolve(fetchBuffer(new URL(res.headers.location, url).toString(), timeoutMs, redirects - 1)); }
            const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => resolve(res.statusCode === 200 ? Buffer.concat(ch) : null));
        });
        req.on('error', () => resolve(null));
        req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
    });
}
const fetchJson = async (url, t) => { try { return JSON.parse((await fetchUrl(url, t)).body); } catch { return null; } };

// ======================= المحتوى =======================
const JOKES = ['مبرمج راح ينام حط جنبه كوباية مية وكوباية فاضية، المليانة لو عطش والفاضية لو معطشش! 😂', 'مرة واحد مبرمج وقع في حفرة، قعد يحاول يعمل Loop عشان يطلع! 🤣', 'ليه المبرمجين بيكرهوا الطبيعة؟ عشان مفيش فيها Ctrl+Z! 💀', 'واحد سأل مبرمج: ليه بتلبس نضارة؟ قاله: عشان أشوف الـ Bugs أوضح! 🤓', 'واحد سأل صاحبه: ليه بتلبس نضارة شمس في الليل؟ قاله: عشان مستقبلي باين 😎', 'مرة واحد راح للدكتور قاله كل ما اشرب شاي توجعني عيني، قاله شيل المعلقة من الكوباية 😂', 'مرة واحد مبرمج خلف توأم سمى واحد نسخة وواحد احتياطي 😂'];
const TRUTH_QS = ['ما هي أكثر لغة برمجة تكرهها؟', 'هل سرقت كود من StackOverflow اليوم؟', 'ما هو أكبر خطأ برمجي تسببت فيه؟', 'هل تعتقد أن الذكاء الاصطناعي سيأخذ مكانك؟', 'ايه اكتر موقف محرج حصلك؟ 😂', 'مين اكتر حد بتحبه في الجروب ده؟ ❤️'];
const DARES = ['ابعت ايموجي يعبر عن شكلك دلوقتي 😂', 'قول لحد انت نجم 🌟', 'اكتب اسمك بالمقلوب في الشات 🔄'];
const FORTUNES = ['النهاردة يوم حظك كويس 😏', 'فيه حد هيبعتلك رسالة تفرحك 📩', 'هتلاقي فلوس في جيبك نسيتها 💰'];
const NASAYEH = ['اللي يزعلك طرده ومتقلقش 😈', 'متنساش تشرب مية 😂', 'النوم بدري أهدى للدماغ 🌙', 'الصحاب مش بالعدد بالمواقف 🤝', 'خليك واثق في نفسك 💪', 'خليك قريب من ربنا 🤲'];
const WISDOMS = ['⚖️ العزّة في القناعة، والذل في الطمع', '🌙 الصمت حكمة', '🗡️ لا تثق بمن يفضح سرّ غيره', '⚓ صاحب من يرفعك', '👑 صبرك على الأذى يصنع منك ملك', '⛔ من تواضع لله رفعه', '⚖️ الرزق بيد الله', '🌙 من ترك شيئاً لله عوضه الله خيراً منه'];
const FACTS = ['القلب البشري بينبض حوالي 100 ألف مرة في اليوم ❤️', 'الأخطبوط عنده 3 قلوب 🐙', 'جسم الإنسان البالغ فيه 206 عظمة 🦴', 'الضوء بياخد حوالي 8 دقايق وتلت من الشمس للأرض ☀️', 'أول إيميل في التاريخ اتبعت سنة 1971 📧', 'أول موقع ويب اتعمل سنة 1991 🌐', 'آدا لوفلايس بتعتبر أول مبرمجة في التاريخ 👩‍💻', 'العسل بيفضل صالح لسنين لو اتخزن صح 🍯'];
const DIDYOUKNOW = ['هل تعلم أن الزرافة رقبتها فيها 7 فقرات بس زي الإنسان؟ 🦒', 'هل تعلم أن المريخ لونه أحمر بسبب أكسيد الحديد؟ 🔴', 'هل تعلم أن النحلة بتزور آلاف الزهور عشان تعمل معلقة عسل واحدة؟ 🐝', 'هل تعلم أن الذكاء الاصطناعي بيتعلم من البيانات مش من الحفظ؟ 🤖', 'هل تعلم أن الكود الأول في التاريخ اتكتب قبل ما الكمبيوتر الحديث يتصنع؟ 💻'];
const ROASTS = ['😏 لو الدماغ بتتشترى إنت كنت فضي عمرك كله', '😂 دماغك أبطأ من نت الفندق', '🤭 إنت الـ Bug اللي مفيش Ctrl+Z ليه', '💀 كلامك زي الباسورد الغلط، بيتعاد كتير ومفيش فايدة', '😎 ميدو الجوهري بيقولك: ريّح دماغك شوية'];   // ضيف ردودك هنا
const HACKS = ['🔐 جاري فك تشفير ملفات RSA-4096...', '📡 اعتراض إشارة قمر صناعي عسكري...', '💻 تجاوز نظام الحماية BIOS...', '🌪️ إطلاق هجوم Storm-Cloud على السيرفر...', '🗝️ استخراج مفتاح التشفير الخاص من الذاكرة...', '💾 سحب بيانات من الـ Deep Web...', '🛰️ ربط مباشر مع ناسا... تم الاختراق!', '🛡️ تعطيل جدار حماية ويندوز...'];
const DUAS = { عام: ['اللهم إنك عفو تحب العفو فاعف عنا', 'اللهم ارزقنا رزقاً حلالاً طيباً', 'اللهم اشرح صدري ويسر أمري', 'يا حي يا قيوم برحمتك أستغيث'], الصباح: ['أصبحنا وأصبح الملك لله'], المساء: ['أمسينا وأمسى الملك لله'], السفر: ['سبحان الذي سخر لنا هذا وما كنا له مقرنين'], النجاح: ['اللهم لا سهل إلا ما جعلته سهلا وأنت تجعل الحزن إذا شئت سهلا'], الرزق: ['اللهم ارزقني رزقا واسعا طيبا مباركا'], المريض: ['اللهم رب الناس أذهب البأس واشف أنت الشافي'], الهم: ['اللهم إني أعوذ بك من الهم والحزن'] };
const AZKAR = {
    صباح: ['🌅 *أذكار الصباح*', '• آية الكرسي (مرة)', '• الإخلاص والفلق والناس (3 مرات)', '• أصبحنا وأصبح الملك لله والحمد لله (مرة)', '• سبحان الله وبحمده (100 مرة)', '• لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير (10 مرات)', '• أستغفر الله وأتوب إليه (100 مرة)'],
    مساء: ['🌙 *أذكار المساء*', '• آية الكرسي (مرة)', '• الإخلاص والفلق والناس (3 مرات)', '• أمسينا وأمسى الملك لله والحمد لله (مرة)', '• سبحان الله وبحمده (100 مرة)', '• أعوذ بكلمات الله التامات من شر ما خلق (3 مرات)', '• أستغفر الله وأتوب إليه (100 مرة)'],
};
const NAMES99 = 'الرحمن الرحيم الملك القدوس السلام المؤمن المهيمن العزيز الجبار المتكبر الخالق البارئ المصور الغفار القهار الوهاب الرزاق الفتاح العليم القابض الباسط الخافض الرافع المعز المذل السميع البصير الحكم العدل اللطيف الخبير الحليم العظيم الغفور الشكور العلي الكبير الحفيظ المقيت الحسيب الجليل الكريم الرقيب المجيب الواسع الحكيم الودود المجيد الباعث الشهيد الحق الوكيل القوي المتين الولي الحميد المحصي المبدئ المعيد المحيي المميت الحي القيوم الواجد الماجد الواحد الأحد الصمد القادر المقتدر المقدم المؤخر الأول الآخر الظاهر الباطن الوالي المتعالي البر التواب المنتقم العفو الرؤوف مالك_الملك ذو_الجلال_والإكرام المقسط الجامع الغني المغني المانع الضار النافع النور الهادي البديع الباقي الوارث الرشيد الصبور'.split(' ').map((n) => n.replace(/_/g, ' '));
const QURAN_SURAHS = ['الفاتحة', 'البقرة', 'ال عمران', 'النساء', 'المائدة', 'الانعام', 'الاعراف', 'الانفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'ابراهيم', 'الحجر', 'النحل', 'الاسراء', 'الكهف', 'مريم', 'طه', 'الانبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الاحزاب', 'سبا', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الاحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الانسان', 'المرسلات', 'النبا', 'النازعات', 'عبس', 'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الاعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الاخلاص', 'الفلق', 'الناس'];
const AZAMA_TEXTS = {
    'وصول_الملك': `👑🔥 وَصُــــولُ الْمَــــلِك 🔥👑\n👑🔥 وصل الملك ${BOT_STYLED} 🔥👑`,
    'ميدو': `🤡🖐 الــــمــــلــــك مــــيــــدو\n👑 حضر الملك: ${BOT_STYLED}`,
    'ميدا': `👑🤡 *ميدا* 🤡👑\nميدا يعني الملك`,
    'دعس': `💀🔥 *الدَعْس بَدَأ* 🔥💀\n👑 ميدو ما بيرحم 🕳️`,
    'كسر': `🦴⚡ *الكَسْر اِتْكَسَر* ⚡🦴\n👑 ${BOT_STYLED}`,
    'ترحيب': `🌟👑 *أهلاً وسهلاً* 👑🌟\n✨ نورت يا نجم ✨`,
    'قمر': `🌙⭐ *قَمَر* ⭐🌙\n👑🔥 ${BOT_STYLED}`,
    'نجمة': `⭐ *نَجْمَة* ⭐\n👑 ${BOT_STYLED}`,
    'نجم': `⭐🔥 *النَّجْم وَصَل* 🔥⭐\n👑✨ نورت يا نجم`,
    'اسطورة': `🏆👑 *اِسْطُورَة* 👑🏆\n👑🔥 ${BOT_STYLED} — الأسطورة`,
    'ملك': `👑🏰 *الْمَلِك وَصَل* 🏰👑\n👑🔥 ${BOT_STYLED}`,
    'وحش': `🦁💀 *الْوَحْش صَحِي* 💀🦁\n👑🔥 ${BOT_STYLED}`,
    'اسد': `🦁 *أَسَد* 🦁\n👑🦁 ${BOT_STYLED}`,
    'صقر': `🦅✨ *الصَّقْر* ✨🦅\n👑🦅 ${BOT_STYLED}`,
    'نمر': `🐯⚡ *النَّمِر* ⚡🐯\n👑🐯 ${BOT_STYLED}`,
    'فرعون': `👑⚱️ *الفِرْعَوْن* ⚱️👑\n👑 ${BOT_STYLED} — فرعون الزمن ده`,
    'امبراطور': `🏛️👑 *الإِمْبِرَاطُور* 👑🏛️\n👑 ${BOT_STYLED}`,
    'قيصر': `⚔️👑 *قَيْصَر* 👑⚔️\n👑 ${BOT_STYLED}`,
    'زعيم': `📢👑 *الزَّعِيم* 👑📢\n👑 ${BOT_STYLED}`,
    'ريس': `🚬👑 *الرِّيِّس* 👑🚬\n👑 ${BOT_STYLED}`,
    'باشا': `🎩👑 *الْبَاشَا* 👑🎩\n👑 ${BOT_STYLED}`,
    'كينج': `👑🔥 *KING* 🔥👑\n👑 ${BOT_STYLED}`,
    'بطل': `🏅💪 *الْبَطَل* 💪🏅\n👑 ${BOT_STYLED}`,
    'جبار': `💥👑 *الْجَبَّار* 👑💥\n👑 ${BOT_STYLED}`,
    'خطير': `🕶️🔥 *خَطِير* 🔥🕶️\n👑 ${BOT_STYLED} — خطير 😈`,
    'عبقري': `🧠✨ *عَبْقَرِي* ✨🧠\n👑 ${BOT_STYLED}`,
    'قدوة': `🌟🤍 *قُدْوَة* 🤍🌟\n👑 ${BOT_STYLED}`,
};
const HACK_SIM = {
    'فحص': () => `🔍 فحص الثغرات...\n⚠️ ${rndNum(1, 10)} ثغرات | تم سدها بواسطة MEDO-WALL v2.0`,
    'ايبى': () => `🌐 IP: 203.0.113.${rndNum(1, 254)}\n📍 Location: Secured by BOSS MEDO`,
    'جدار': () => '🛡️ MEDO-WALL v2.0 ACTIVE — نظامك الآن محصن تماماً',
    'بروكسي': () => '🔒 Proxy: Cairo-Node-01 | Status: Encrypted',
    'هجوم': () => '⚠️ محاكاة هجوم DDoS...\nTarget: 127.0.0.1\nPackets: 1.5GB/s\nResult: Server Down! 💀',
    'تخمين': () => `🔑 جاري تخمين كلمة المرور...\nAttempt 1... Fail\nAttempt ${rndNum(100, 999)}... Success! ✅`,
    'حقن': () => '💉 SQL Injection...\n`SELECT * FROM users`\n✅ تم سحب قاعدة البيانات بنجاح!',
    'بورت': () => '🔌 Scanning Ports...\n80: OPEN\n443: OPEN\n21: CLOSED',
    'باب': () => '🚪 تم زرع باب خلفي في نظام الهدف. يمكنك الدخول الآن.',
    'سنافر': () => "📡 Capturing packets...\nTCP Stream 1: Found Password 'admin123'",
    'ثغرة': () => '🚨 تم العثور على ثغرة Zero-Day! جاري استغلالها... ✅',
    'عشوائي': () => `⚡ ${rand(HACKS)}\n✅ تم التنفيذ بواسطة ميدو!`,
};
const NUM_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

// ======================= سجل الأوامر والأقسام =======================
const SECTIONS = {
    1: { icon: '📥', name: 'التحميل', desc: 'تحميل من كل المنصات' },
    2: { icon: '🖼️', name: 'صور وستيكرات', desc: 'ملصقات وصور وخلفيات' },
    3: { icon: '👥', name: 'الجروبات', desc: 'إدارة الجروبات' },
    4: { icon: '🛡️', name: 'الحماية', desc: 'حماية وتحذيرات وقفل البوت' },
    5: { icon: '⚙️', name: 'الهكر والمحاكاة', desc: 'اختراق وهمي للفرفشة 🧪', compact: true },
    6: { icon: '📚', name: 'المعلومات', desc: 'مكتبة معلومات' },
    7: { icon: '🎁', name: 'اقتصاد', desc: 'فلوس ومسابقات وإحصائيات' },
    8: { icon: '🎮', name: 'الترفيه', desc: 'ألعاب وضحك' },
    9: { icon: '🛠️', name: 'أدوات', desc: 'خدمات سريعة' },
    10: { icon: '🤲', name: 'دين', desc: 'قرآن وأذكار' },
    11: { icon: '🤖', name: 'ذكاء', desc: 'تحدث مع البوت' },
    12: { icon: '🎙️', name: 'صوتيات', desc: 'تعديل الأصوات' },
    13: { icon: '🎭', name: 'عظمة', desc: 'كلمات الملوك (من غير نقطة)', compact: true },
    14: { icon: '👑', name: 'الملك والبوت', desc: 'القائمة والقناة والمطورين' },
    15: { icon: '🧰', name: 'المطورين', desc: 'للأونر فقط' },
};
const REG = new Map();
const LIST = [];
function def(sec, names, desc, a, b) {
    const opts = typeof a === 'function' ? {} : a;
    const run = typeof a === 'function' ? a : b;
    const cmd = { sec, names: [].concat(names), desc, ...opts, run };
    LIST.push(cmd);
    for (const n of cmd.names) REG.set(normAr(n), cmd);
}
const G = { group: true, admin: true };
const GB = { group: true, admin: true, botAdmin: true };
const ALWAYS = { always: true };

const cmdsOf = (id) => LIST.filter((x) => x.sec === Number(id));
function mainMenu() {
    const rows = Object.entries(SECTIONS).map(([id, s]) => `┃ ${s.icon} *${id}. ${s.name}*  ‹${cmdsOf(id).length}›\n┃    ↳ ${s.desc}`);
    return withFooter(`╔━━━━━━━━━━━━━━━━━━━╗\n      👑 *${BOT_NAME}* 👑\n      ✦ النسخة الملكية الموحدة ✦\n╚━━━━━━━━━━━━━━━━━━━╝\n\n📂 *الأقسام الرئيسية*\n┏━━━━━━━━━━━━━━━━━━━\n${rows.join('\n┃\n')}\n┗━━━━━━━━━━━━━━━━━━━\n\n💡 *.مساعدة [رقم]* لفتح القسم\n📜 *.اوامر* لعرض الكل (${LIST.length} أمر)\n🆔 ID: 01001209061`);
}
function sectionMenu(id) {
    const s = SECTIONS[id]; const list = cmdsOf(id);
    const body = s.compact ? list.map((x) => '.' + x.names[0]).join('  •  ') : list.map((x) => `◈ *.${x.names[0]}*\n   ${x.desc}`).join('\n');
    return withFooter(`╭━━━〔 ${s.icon} ${s.name} 〕━━━╮\n  ${s.desc}  ‹${list.length}›\n╰━━━━━━━━━━━━━━━━━━╯\n\n${body}\n\n━━━━━━━━━━━━━━━━━━━\n🔙 .منيو   |   📜 .اوامر`);
}
function fullMenu() {
    const body = Object.entries(SECTIONS).map(([id, s]) => `${s.icon} *${id}. ${s.name}*\n${cmdsOf(id).map((x) => '.' + x.names[0]).join(' • ')}`).join('\n\n');
    return withFooter(`╔━━━━━━━━━━━━━━━━━━━╗\n  👑 ${BOT_NAME}\n  📖 كل الأوامر — ${LIST.length} أمر\n╚━━━━━━━━━━━━━━━━━━━╝\n\n${body}`);
}
async function animate(c, steps, delay = 700) {
    const sent = await c.send(steps[0]);
    if (!sent?.key) return;
    for (let i = 1; i < steps.length; i++) { await sleep(delay); try { await c.sock.sendMessage(c.jid, { text: steps[i], edit: sent.key }); } catch {} }
}
const quotedOrOwn = (msg) => { const raw = unwrap(msg?.message); const ctx = getContextInfo(msg); return { raw, quoted: ctx?.quotedMessage ? unwrap(ctx.quotedMessage) : null }; };
const toggler = (key, label, on, off) => async (c) => {
    const gs = getChat(c.jid); const a = normAr(c.args);
    if (a.includes('تشغيل') || a === 'on') gs[key] = true; else if (a.includes('تعطيل') || a === 'off') gs[key] = false;
    else return c.say(`${label}: ${gs[key] ? 'مفعلة ✅' : 'متوقفة ❌'}\n.${c.cmdName} تشغيل / تعطيل`);
    saveDB(); return c.say(gs[key] ? on : off);
};

// ======================= 1) التحميل =======================
let activeDownloads = 0;
const execCmd = (cmd, args, timeout = 300000) => new Promise((res) => execFile(cmd, args, { timeout, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => res({ err, stdout, stderr })));
async function ytdlp(args) {
    let r = await execCmd('yt-dlp', args);
    if (r.err?.code === 'ENOENT') for (const py of ['python3', 'python']) { r = await execCmd(py, ['-m', 'yt_dlp', ...args]); if (r.err?.code !== 'ENOENT') break; }
    return r;
}
const extractUrl = (s) => (String(s || '').match(/https?:\/\/[^\s]+/i) || [''])[0];
const newOutBase = (p) => path.join(CONFIG.DOWNLOAD_FOLDER, `${p}_${Date.now()}_${rndNum(0, 9999)}`);
function findDownloaded(out) { try { const base = path.basename(out) + '.'; const fl = fs.readdirSync(CONFIG.DOWNLOAD_FOLDER).filter((f) => f.startsWith(base) && !f.endsWith('.part')); if (!fl.length) return null; return path.join(CONFIG.DOWNLOAD_FOLDER, fl.find((f) => f.endsWith('.mp3')) || fl.find((f) => f.endsWith('.mp4')) || fl[0]); } catch { return null; } }
function cleanupDownloads(out) { try { const base = path.basename(out) + '.'; for (const f of fs.readdirSync(CONFIG.DOWNLOAD_FOLDER)) if (f.startsWith(base)) try { fs.unlinkSync(path.join(CONFIG.DOWNLOAD_FOLDER, f)); } catch {} } catch {} }
async function download(c, o) {
    const url = extractUrl(o.target);
    if (!o.target || (url && o.urlRe && !o.urlRe.test(url)) || (!url && !o.search)) return c.say(o.usage);
    if (activeDownloads >= CONFIG.MAX_PARALLEL_DOWNLOADS) return c.say('⏳ في تحميلات شغالة، جرب كمان شوية');
    activeDownloads++;
    const out = newOutBase(o.prefix);
    try {
        await c.react('⏳');
        const common = ['--max-filesize', CONFIG.MAX_FILE_SIZE, '--no-playlist', '--no-warnings', '--no-progress', '--quiet', '-o', out + '.%(ext)s', url || 'ytsearch1:' + o.target];
        await ytdlp(o.audio ? ['-x', '--audio-format', 'mp3', '--audio-quality', '5', ...common] : ['-f', 'bv*[height<=720]+ba/b[height<=720]/b', '--merge-output-format', 'mp4', ...common]);
        const file = findDownloaded(out);
        if (!file) return await c.say('❌ فشل التحميل (اتأكد من الرابط ومن تثبيت yt-dlp)');
        await c.react('✅');
        try { await c.sock.sendMessage(c.jid, o.audio ? { audio: { url: file }, mimetype: 'audio/mpeg', fileName: (url ? 'audio' : o.target.slice(0, 40)) + '.mp3' } : { video: { url: file }, mimetype: 'video/mp4', caption: withFooter(o.done) }, { quoted: c.msg }); }
        catch { await c.say('❌ الملف كبير'); }
    } finally { cleanupDownloads(out); activeDownloads--; }
}
def(1, ['تحميل', 'download', 'dl'], 'أي رابط فيديو', (c) => download(c, { target: c.args, urlRe: /^https?:/i, usage: '📥 .تحميل <رابط>', prefix: 'dl', done: '✅ تم التحميل' }));
def(1, ['يوتيوب', 'yt'], 'فيديو يوتيوب (رابط أو اسم)', (c) => download(c, { target: c.args, urlRe: /youtu/i, search: true, usage: '▶️ .يوتيوب <رابط أو اسم>', prefix: 'yt', done: '✅ يوتيوب' }));
def(1, ['play', 'صوت', 'اغنية'], 'أغنية MP3 (اسم أو رابط)', (c) => download(c, { audio: true, target: c.args, search: true, usage: '🎵 .play <اسم الأغنية>', prefix: 'audio' }));
def(1, ['تيك', 'tiktok'], 'فيديو تيك توك', (c) => download(c, { target: c.args, urlRe: /tiktok\.com/i, usage: '🎬 .تيك <رابط>', prefix: 'tik', done: '✅ تيك توك' }));
def(1, ['فيس', 'facebook'], 'فيديو فيسبوك', (c) => download(c, { target: c.args, urlRe: /facebook\.com|fb\.watch/i, usage: '📘 .فيس <رابط>', prefix: 'fb', done: '✅ فيسبوك' }));
def(1, ['انستا', 'instagram'], 'ريلز/فيديو انستجرام', (c) => download(c, { target: c.args, urlRe: /instagram\.com/i, usage: '📸 .انستا <رابط>', prefix: 'ig', done: '✅ انستجرام' }));

// ======================= 2) صور وستيكرات =======================
def(2, ['ملصق', 'ستيكر', 'sticker'], 'حول صورة/فيديو لملصق (رد عليها)', async (c) => {
    const { raw, quoted } = quotedOrOwn(c.msg);
    const target = raw?.imageMessage || raw?.videoMessage ? raw : quoted;
    if (!target?.imageMessage && !target?.videoMessage) return c.say('❌ رد على صورة/فيديو واكتب .ملصق');
    await c.react('🎨');
    const id = `${Date.now()}_${rndNum(0, 999)}`; const isVid = !!target.videoMessage;
    const inF = path.join(CONFIG.DOWNLOAD_FOLDER, `stk_in_${id}.${isVid ? 'mp4' : 'jpg'}`); const outF = path.join(CONFIG.DOWNLOAD_FOLDER, `stk_out_${id}.webp`);
    try {
        fs.writeFileSync(inF, await DL({ message: target }, 'buffer', {}, { logger: P({ level: 'silent' }), reuploadRequest: c.sock.updateMediaMessage }));
        const vf = 'scale=512:512:force_original_aspect_ratio=decrease,' + (isVid ? 'fps=15,' : '') + 'pad=512:512:-1:-1:color=white@0.0';
        await execCmd('ffmpeg', ['-y', '-i', inF, '-vcodec', 'libwebp', '-vf', vf, ...(isVid ? ['-loop', '0', '-t', '00:00:07'] : []), outF], 30000);
        if (fs.existsSync(outF)) await c.sock.sendMessage(c.jid, { sticker: fs.readFileSync(outF) }, { quoted: c.msg }); else await c.say('❌ ثبت ffmpeg');
    } catch { await c.say('❌ فشل الملصق'); }
    finally { for (const f of [inF, outF]) try { fs.unlinkSync(f); } catch {} }
});
def(2, ['كشف', 'reveal'], 'كشف رسالة العرض مرة واحدة (رد عليها)', async (c) => {
    const { quoted } = quotedOrOwn(c.msg); const rawQ = getContextInfo(c.msg)?.quotedMessage;
    if (!rawQ) return c.say('❌ رد على رسالة عرض مرة واحدة واكتب .كشف');
    const inner = rawQ.viewOnceMessage?.message || rawQ.viewOnceMessageV2?.message || rawQ.viewOnceMessageV2Extension?.message || quoted || rawQ;
    const type = inner.imageMessage ? 'image' : inner.videoMessage ? 'video' : inner.audioMessage ? 'audio' : null; const obj = inner.imageMessage || inner.videoMessage || inner.audioMessage;
    if (!type) return c.say('❌ مش رسالة عرض مرة واحدة');
    try {
        await c.react('👁️');
        const buffer = await DL({ message: inner }, 'buffer', {}, { logger: P({ level: 'silent' }), reuploadRequest: c.sock.updateMediaMessage });
        const cap = withFooter(`👁️ *تم كشف رسالة العرض مرة واحدة*${obj.caption ? '\n📝 ' + obj.caption : ''}`);
        const payload = type === 'image' ? { image: buffer, caption: cap } : type === 'video' ? { video: buffer, caption: cap } : { audio: buffer, mimetype: obj.mimetype || 'audio/mp4', ptt: !!obj.ptt };
        await c.sock.sendMessage(c.jid, payload, { quoted: c.msg });
    } catch { await c.say('❌ فشل — اتفتحت قبل كده'); }
});
def(2, ['صورة', 'pp'], 'صورة بروفايل أي حد (منشن/رقم)', async (c) => {
    const t = targetOf(c.msg, c.args) || c.sender;
    try { const url = await c.sock.profilePictureUrl(t, 'image'); await c.sock.sendMessage(c.jid, { image: { url }, caption: withFooter(`🖼️ +${numOf(t)}`) }, { quoted: c.msg }); }
    catch { await c.say('🔒 الصورة مخفية أو مش متاحة'); }
});
def(2, ['خلفيات', 'wallpaper'], 'خلفية موبايل عشوائية', async (c) => {
    await c.react('🌄'); const buf = await fetchBuffer(`https://picsum.photos/1080/1920?random=${Date.now()}`);
    if (buf) await c.sock.sendMessage(c.jid, { image: buf, caption: withFooter('🌄 خلفية عشوائية') }, { quoted: c.msg }); else await c.say('❌ فشل تحميل الخلفية');
});
def(2, ['كرتون', 'cartoon'], 'أفاتار كرتوني باسمك (أو أي اسم)', async (c) => {
    const buf = await fetchBuffer(`https://api.dicebear.com/7.x/adventurer/png?size=512&seed=${encodeURIComponent(c.args || c.num)}`);
    if (buf) await c.sock.sendMessage(c.jid, { image: buf, caption: withFooter('🎨 أفاتارك الكرتوني') }, { quoted: c.msg }); else await c.say('❌ فشل');
});

// ======================= 3) الجروبات =======================
def(3, ['حذف', 'مسح', 'del'], 'مسح رسالة (رد عليها)', GB, async (c) => {
    const ctx = getContextInfo(c.msg); if (!ctx?.stanzaId) return c.say('❌ رد على الرسالة واكتب .حذف');
    try { await c.sock.sendMessage(c.jid, { delete: { remoteJid: c.jid, fromMe: false, id: ctx.stanzaId, participant: ctx.participant } }); await c.react('🗑️'); } catch { await c.say('❌ فشل الحذف'); }
});
const pin = (type) => async (c) => {
    const ctx = getContextInfo(c.msg); if (!ctx?.stanzaId) return c.say('❌ رد على رسالة الأول');
    try { await c.sock.sendMessage(c.jid, { pin: { key: { remoteJid: c.jid, id: ctx.stanzaId, participant: ctx.participant, fromMe: false }, type, ...(type === 1 ? { time: 86400 } : {}) } }); await c.say(type === 1 ? '📌 تم التثبيت' : '📌 تم الغاء التثبيت'); } catch { await c.say('❌ فشل'); }
};
def(3, ['تثبيت', 'ثبت', 'pin'], 'تثبيت رسالة 24 ساعة (رد عليها)', G, pin(1));
def(3, ['الغاء_تثبيت', 'unpin'], 'الغاء تثبيت رسالة', G, pin(2));
def(3, ['منشن_الكل', 'تاجالكل', 'الجميع'], 'منشن ظاهر للكل', { ...G, noPrefix: true }, async (c) => {
    const ids = c.group.participants.map((p) => p.id);
    await c.sock.sendMessage(c.jid, { text: withFooter(`📢 *منشن للكل*\n\n${ids.map((i) => '@' + numOf(i)).join(' ')}\n\n${c.args || 'الكل يركز هنا 👑'}`), mentions: ids }, { quoted: c.msg });
});
def(3, ['طرد', 'زق', 'kick'], 'طرد عضو (منشن/رد)', GB, async (c) => {
    const t = targetOf(c.msg, c.args); if (!t) return c.say('❌ منشن العضو');
    if (isOwner(t) || isOwnerParticipant(findParticipant(c.group, t))) return c.say('👑 مينفعش تطرد الأونر');
    try { await c.sock.groupParticipantsUpdate(c.jid, [t], 'remove'); await c.say(`👢 @${numOf(t)} اتطرد`, { mentions: [t] }); } catch { await c.say('❌ فشل'); }
});
const nuke = new Map();
def(3, ['طرد_الكل'], 'طرد كل الأعضاء ماعدا المشرفين (أونر + تأكيد)', { owner: true, group: true, botAdmin: true }, async (c) => {
    const p = nuke.get(c.jid);
    if (p && p.by === c.num && Date.now() - p.time < 30000) {
        nuke.delete(c.jid);
        const list = c.group.participants.filter((x) => !isAdmin(x) && !isOwnerParticipant(x) && !sameUser(x.id, c.sock.user.id)).map((x) => x.id);
        await c.say(`💀 بطرد ${list.length} عضو...`);
        for (let i = 0; i < list.length; i += 5) { try { await c.sock.groupParticipantsUpdate(c.jid, list.slice(i, i + 5), 'remove'); await sleep(1500); } catch {} }
        return c.say(`✅ تم طرد ${list.length}`);
    }
    nuke.set(c.jid, { by: c.num, time: Date.now() });
    return c.say('⚠️ هتطرد كل الأعضاء ماعدا المشرفين\nاكتب .طرد_الكل تاني خلال 30 ثانية للتأكيد');
});
def(3, ['ارفعني'], 'ارفعني مشرف (للأونر)', { owner: true, group: true, botAdmin: true, noPrefix: true }, async (c) => {
    try { await c.sock.groupParticipantsUpdate(c.jid, [findParticipant(c.group, c.sender)?.id || c.sender], 'promote'); await c.say('👑 تم رفعك مشرف'); } catch { await c.say('❌ فشل'); }
});
const promoter = (act) => async (c) => {
    const t = targetOf(c.msg, c.args); if (!t) return c.say('❌ منشن العضو');
    try { await c.sock.groupParticipantsUpdate(c.jid, [t], act); await c.say(act === 'promote' ? '⬆️ تمت الترقية' : '⬇️ تم التنزيل'); } catch { await c.say('❌ فشل'); }
};
def(3, ['ترقية', 'ترقيه'], 'ترقية عضو لمشرف', GB, promoter('promote'));
def(3, ['تنزيل'], 'تنزيل مشرف لعضو', GB, promoter('demote'));
def(3, ['قفل'], 'قفل الجروب (المشرفين بس يكتبوا)', GB, async (c) => { try { await c.sock.groupSettingUpdate(c.jid, 'announcement'); await c.say('🔒 الجروب اتقفل'); } catch { await c.say('❌ فشل'); } });
def(3, ['فتح'], 'فتح الجروب للكل', GB, async (c) => { try { await c.sock.groupSettingUpdate(c.jid, 'not_announcement'); await c.say('🔓 الجروب اتفتح'); } catch { await c.say('❌ فشل'); } });
def(3, ['اسم'], 'تغيير اسم الجروب', GB, async (c) => { if (!c.args) return c.say('✏️ .اسم <الاسم الجديد>'); try { await c.sock.groupUpdateSubject(c.jid, c.args); await c.say('✅ تم تغيير الاسم'); } catch { await c.say('❌ فشل'); } });
def(3, ['وصف'], 'تغيير وصف الجروب', GB, async (c) => { if (!c.args) return c.say('✏️ .وصف <الوصف الجديد>'); try { await c.sock.groupUpdateDescription(c.jid, c.args); await c.say('✅ تم تغيير الوصف'); } catch { await c.say('❌ فشل'); } });
def(3, ['رابط', 'link'], 'رابط دعوة الجروب', { group: true }, async (c) => { try { await c.say(`🔗 https://chat.whatsapp.com/${await c.sock.groupInviteCode(c.jid)}`); } catch { await c.say('❌ مش قادر (لازم البوت مشرف)'); } });
def(3, ['مشرفين', 'admins'], 'قائمة المشرفين', { group: true }, async (c) => { const a = c.group.participants.filter(isAdmin); await c.say(`🛡️ *المشرفين (${a.length})*\n${a.map((p) => '• @' + numOf(p.id)).join('\n')}`, { mentions: a.map((p) => p.id) }); });

// ======================= 4) الحماية =======================
def(4, ['حماية', 'مضاد_رابط', 'antilink'], 'حماية الروابط (تشغيل/تعطيل)', G, toggler('antilink', '🛡️ حماية الروابط', '🛡️ تم تفعيل حماية الروابط (3 لينكات = طرد)', '🔓 تم تعطيل حماية الروابط'));
def(4, ['سبام', 'antispam'], 'مضاد السبام (تشغيل/تعطيل)', G, toggler('antispam', '🚨 مضاد السبام', '🚨 تم تفعيل مضاد السبام', '🔓 تم تعطيل مضاد السبام'));
def(4, ['استقبال', 'welcome'], 'رسالة الترحيب (تشغيل/تعطيل)', G, toggler('welcome', '🌟 الترحيب', '🌟 تم تفعيل الترحيب', '🔕 تم تعطيل الترحيب'));
def(4, ['انذار', 'تحذير', 'warn'], 'انذار لعضو (3 انذارات = طرد)', G, async (c) => {
    const t = targetOf(c.msg, c.args); if (!t) return c.say('❌ منشن العضو');
    const k = c.jid + ':' + numOf(t); DB.warns[k] = (DB.warns[k] || 0) + 1; saveDB();
    if (DB.warns[k] >= 3) { await c.say(`⚠️ @${numOf(t)} وصل 3 انذارات وهيتطرد`, { mentions: [t] }); try { await c.sock.groupParticipantsUpdate(c.jid, [t], 'remove'); DB.warns[k] = 0; } catch {} }
    else await c.say(`⚠️ @${numOf(t)} انذار ${DB.warns[k]}/3`, { mentions: [t] });
});
def(4, ['تحذيرات', 'warns'], 'شوف تحذيراتك أو تحذيرات عضو', async (c) => { const t = targetOf(c.msg, c.args) || c.sender; await c.say(`⚠️ @${numOf(t)} عنده ${DB.warns[c.jid + ':' + numOf(t)] || 0}/3`, { mentions: [t] }); });
def(4, ['مسح_تحذيرات', 'clearwarns'], 'مسح تحذيرات عضو', G, async (c) => { const t = targetOf(c.msg, c.args); if (!t) return c.say('❌ منشن العضو'); DB.warns[c.jid + ':' + numOf(t)] = 0; saveDB(); await c.say(`✅ مسحت تحذيرات @${numOf(t)}`, { mentions: [t] }); });
def(4, ['قفل_البوت', 'اقفل_البوت', 'lockbot'], 'قفل كل الأوامر للأونر فقط', { owner: true, ...ALWAYS }, async (c) => { getChat(c.jid).botLocked = true; saveDB(); await c.say('🔒 *تم قفل البوت للأونر فقط*\nمحدش هيقدر يستخدم الأوامر غيرك\n.فتح_البوت — يفتح للكل'); });
def(4, ['فتح_البوت', 'افتح_البوت', 'unlockbot'], 'فتح الأوامر للكل', { owner: true, ...ALWAYS }, async (c) => { getChat(c.jid).botLocked = false; saveDB(); await c.say('🔓 *تم فتح البوت للجميع*\n.قفل_البوت — يقفل تاني'); });
def(4, ['حالة_البوت', 'حاله_البوت'], 'البوت مقفول ولا مفتوح؟', ALWAYS, async (c) => c.say(`🤖 *حالة البوت*\n${getChat(c.jid).botLocked ? '🔒 مقفول للأونر فقط 👑' : '🔓 مفتوح للجميع ✅'}`));

// ======================= 5) الهكر والمحاكاة (وهمي) =======================
def(5, ['اختراق', 'hack'], 'اختراق وهمي بشريط تحميل', async (c) => {
    const bar = (p) => '█'.repeat(p / 10) + '▒'.repeat(10 - p / 10);
    await animate(c, [10, 30, 50, 80, 100].map((p) => `⏳ جاري اختراق السيرفر...\n[${bar(p)}] ${p}%` + (p === 100 ? '\n✅ تم بنجاح بواسطة ميدو الجوهري 01001209061!\n🧪 محاكاة للفرفشة 😂' : '')));
});
for (const [k, fn] of Object.entries(HACK_SIM)) def(5, k, 'محاكاة', (c) => c.say(fn() + '\n\n🧪 محاكاة للفرفشة — مفيش حاجة اتخترقت بجد 😂'));

// ======================= 6) المعلومات =======================
def(6, ['معلومة', 'معلومه'], 'معلومة عشوائية', (c) => c.say('📚 ' + rand(FACTS)));
def(6, ['هل_تعلم'], 'هل تعلم؟', (c) => c.say('💡 ' + rand(DIDYOUKNOW)));

// ======================= 7) اقتصاد وإحصائيات =======================
def(7, ['بنك', 'bank'], 'رصيدك', (c) => c.say(`🏦 فلوسك: ${getUser(c.num).money} جنيه\nاكتب .يومية`));
def(7, ['يومية', 'daily'], '500 جنيه كل 24 ساعة', (c) => {
    const u = getUser(c.num); const now = Date.now();
    if (now - u.lastDaily < 86400000) return c.say(`⏳ لسه بدري — فاضل ${fmtUptime(86400000 - (now - u.lastDaily))}`);
    u.money += 500; u.lastDaily = now; saveDB(); return c.say(`🎁 خدت 500 جنيه\nرصيدك: ${u.money}`);
});
def(7, ['سرقة', 'سرقه'], 'اسرق فلوس من عضو (منشن)', async (c) => {
    const t = targetOf(c.msg, c.args); if (!t) return c.say('💸 .سرقة @منشن');
    const tn = numOf(t); if (tn === c.num) return c.say('😂 هتسرق نفسك؟');
    const me = getUser(c.num); if (me.money < 100) return c.say('فقير متقدرش تسرق 😂');
    if (onCooldown('rob:' + c.num, 120000)) return c.say('⏳ استنى شوية بين كل سرقة والتانية');
    const v = getUser(tn); const amt = Math.min(rndNum(50, 200), v.money);
    me.money += amt; v.money -= amt; saveDB();
    await c.say(`💸 سرقت ${amt} جنيه من @${tn} 😈\nرصيدك: ${me.money}`, { mentions: [t] });
});
def(7, ['حظ', 'قمار'], 'قمار: يا تكسب يا تخسر (.حظ 100)', (c) => {
    const me = getUser(c.num); const bet = parseInt(c.args) || 100;
    if (bet < 10) return c.say('❌ أقل رهان 10 جنيه'); if (bet > me.money) return c.say('فلوسك متكفيش 💸');
    const win = Math.random() > 0.5; me.money += win ? bet : -bet; saveDB();
    return c.say(win ? `🎰 كسبت ${bet} جنيه! رصيدك: ${me.money}` : `💀 خسرت ${bet} جنيه! رصيدك: ${me.money}`);
});
def(7, ['زواج'], 'عقد قران بمنشن', async (c) => {
    let t = targetOf(c.msg, c.args);
    if (!t && isGroup(c.jid)) { const g = await c.getGroup(); const others = (g?.participants || []).map((p) => p.id).filter((id) => !sameUser(id, c.sender)); if (others.length) t = rand(others); }
    if (!t) return c.say('💍 .زواج @منشن');
    const tn = numOf(t); if (tn === c.num) return c.say('😂 هتتجوز نفسك؟');
    if (DB.marriage[c.num]) return c.say('❌ انت متجوز أصلا — اكتب .طلاق الأول 😂'); if (DB.marriage[tn]) return c.say('❌ هو/هي متجوز/ة 😅');
    DB.marriage[c.num] = tn; DB.marriage[tn] = c.num; saveDB(); await c.react('💍');
    let pp1 = 'https://i.ibb.co/5cK6Q7M/avatar.png', pp2 = pp1;
    try { pp1 = (await c.sock.profilePictureUrl(c.sender, 'image')) || pp1; } catch {} try { pp2 = (await c.sock.profilePictureUrl(t, 'image')) || pp2; } catch {}
    const cert = withFooter(`╭─── 💍 *وثيقة عقد قران* 💍 ───╮\n│ 👑 الملك: ${BOT_STYLED}\n│ 🤵 العريس: @${c.num}\n│ 👰 العروسة: @${tn}\n│ 📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}\n│ 💝 المهر: 100 مليون بوثه😻♥💋\n│ ميدو الجوهري بيحبكو — الف مبروك\n╰──────────────────╯`);
    const img = await fetchBuffer(`https://api.popcat.xyz/v2/shipping?user1=${encodeURIComponent(pp1)}&user2=${encodeURIComponent(pp2)}`);
    if (img) await c.sock.sendMessage(c.jid, { image: img, caption: cert, mentions: [c.sender, t] }, { quoted: c.msg }); else await c.send(cert, { mentions: [c.sender, t] });
});
def(7, ['طلاق'], 'طلاق', (c) => {
    const ex = DB.marriage[c.num]; if (!ex) return c.say('انت مش متجوز أصلا 😂');
    delete DB.marriage[c.num]; delete DB.marriage[ex]; saveDB(); return c.say(`💔 تم الطلاق بين ${c.num} و ${ex}\nربنا يعوض عليكم 😅`);
});
def(7, ['توب', 'top'], 'أغنى 5 وأعلى لفل', (c) => {
    const us = Object.entries(DB.users);
    const m = [...us].sort((a, b) => b[1].money - a[1].money).slice(0, 5).map(([n, d], i) => `${i + 1}. ${n} — ${d.money} جنيه`).join('\n');
    const l = [...us].sort((a, b) => b[1].lvl - a[1].lvl).slice(0, 5).map(([n, d], i) => `${i + 1}. ${n} — لفل ${d.lvl}`).join('\n');
    return c.say(`🏆 *توب البوت*\n\n💰 *أغنى 5:*\n${m}\n\n🆙 *أعلى لفل:*\n${l}`);
});
def(7, ['رسايلي'], 'عدد رسايلك وترتيبك', (c) => {
    const us = Object.entries(DB.users).sort((a, b) => b[1].msgs - a[1].msgs); const rank = us.findIndex(([k]) => k === c.num) + 1;
    return c.say(`📈 رسايلك: ${getUser(c.num).msgs}\n🏆 ترتيبك: ${rank || us.length + 1}\n🌍 الكل: ${us.reduce((s, [, d]) => s + d.msgs, 0)}`);
});
def(7, ['ترتيب', 'rank'], 'أنشط 10 في الرسايل', (c) => c.say(`🏆 *أنشط الأعضاء*\n${Object.entries(DB.users).sort((a, b) => b[1].msgs - a[1].msgs).slice(0, 10).map(([n, d], i) => `${i + 1}. ${n} — ${d.msgs}`).join('\n')}`));
def(7, ['ايدي', 'id'], 'بطاقتك', (c) => { const u = getUser(c.num); return c.say(`🆔 *بطاقتك*\n👤 +${c.num}\n⭐ لفل: ${u.lvl}  (XP ${u.xp}/50)\n✉️ رسايل: ${u.msgs}\n💰 فلوس: ${u.money}\n💍 متجوز: ${DB.marriage[c.num] || 'لا'}\n⚠️ تحذيرات: ${DB.warns[c.jid + ':' + c.num] || 0}/3`); });
def(7, ['لفل', 'level'], 'لفلك و XP', (c) => { const u = getUser(c.num); return c.say(`⭐ لفلك: ${u.lvl}\nXP: ${u.xp}/50`); });

// ======================= 8) الترفيه =======================
def(8, ['نكتة', 'نكته'], 'نكتة عشوائية', (c) => c.say('🤣 ' + rand(JOKES)));
def(8, ['حب', 'love'], 'نسبة الحب', (c) => c.say(`❤️ نسبة الحب: ${rndNum(0, 100)}%`));
def(8, ['بحبني', 'احبك'], 'بتحبني كام؟ (منشن)', (c) => {
    const t = targetOf(c.msg, c.args) || c.sender; const p = rndNum(0, 100); const n = Math.floor(p / 10);
    return c.say(`❤️ بحبني كم ؟\n👤 @${c.num}\n💘 @${numOf(t)}\n📊 ${p}%\n${'❤️'.repeat(n)}${'🤍'.repeat(10 - n)}`, { mentions: [c.sender, t] });
});
def(8, ['توافق'], 'نسبة التوافق (منشن)', (c) => { const t = targetOf(c.msg, c.args) || c.sender; return c.say(`🤝 توافق @${c.num} و @${numOf(t)}: ${rndNum(0, 100)}%`, { mentions: [c.sender, t] }); });
def(8, ['عملة', 'coin'], 'ملك ولا كتابة', (c) => c.say(`🪙 ${Math.random() > 0.5 ? 'ملك 👑' : 'كتابة 📖'}`));
def(8, ['زهر', 'dice'], 'نرد', (c) => c.say(`🎲 النتيجة: ${rndNum(1, 6)}`));
def(8, ['مقص'], 'حجر ورقة مقص (.مقص حجر)', (c) => {
    const opts = ['حجر', 'ورقة', 'مقص']; const me = normAr(c.args); const mine = opts.find((o) => normAr(o) === me);
    if (!mine) return c.say('✊✋✌️ .مقص حجر / ورقة / مقص');
    const bot = rand(opts); const win = (mine === 'حجر' && bot === 'مقص') || (mine === 'ورقة' && bot === 'حجر') || (mine === 'مقص' && bot === 'ورقة');
    return c.say(`انت: ${mine}\nالبوت: ${bot}\n\n${mine === bot ? '🤝 تعادل' : win ? '🏆 كسبت!' : '😈 البوت كسب!'}`);
});
def(8, ['صراحة', 'صراحه'], 'سؤال صراحة', (c) => c.say('🤐 ' + rand(TRUTH_QS)));
def(8, ['جرأة', 'جراه', 'تحدي'], 'تحدي جرأة', (c) => c.say('🔥 ' + rand(DARES)));
def(8, ['حظك'], 'حظك النهاردة', (c) => c.say('🔮 ' + rand(FORTUNES)));
def(8, ['فكرة', 'فكره'], 'فكرة مجنونة', (c) => c.say('💡 اعمل جروب تاني واطرد الكل 😈'));
def(8, ['نصيحة', 'نصايح'], 'نصيحة', (c) => c.say('🧠 ' + rand(NASAYEH)));
def(8, ['شتمة', 'شتمه', 'اشتمني'], 'تريقة خفيفة 😏', (c) => c.say(rand(ROASTS)));
def(8, ['شبح'], 'استحضار الأرواح', (c) => c.say('👻 جاري استحضار الأرواح... روح المبرمجين الغاضبين تحيط بك الآن!'));
def(8, ['ميم', 'meme'], 'ميم عشوائي', async (c) => {
    const d = await fetchJson('https://meme-api.com/gimme'); if (!d?.url) return c.say('❌ مفيش ميم دلوقتي');
    try { await c.sock.sendMessage(c.jid, { image: { url: d.url }, caption: withFooter('😂 ' + (d.title || 'ميم اليوم')) }, { quoted: c.msg }); } catch { await c.say('❌ فشل'); }
});
const xoGames = new Map();
const XO_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const xoWin = (b, s) => XO_LINES.some((l) => l.every((i) => b[i] === s));
const xoShow = (b) => [0, 3, 6].map((r) => [0, 1, 2].map((k) => (b[r + k] === 'X' ? '❌' : b[r + k] === 'O' ? '⭕' : NUM_EMOJI[r + k])).join('')).join('\n');
function xoBot(b) {
    const free = b.map((v, i) => (v ? null : i)).filter((i) => i !== null);
    for (const s of ['O', 'X']) for (const i of free) { const t = [...b]; t[i] = s; if (xoWin(t, s)) return i; }
    return b[4] ? rand(free) : 4;
}
def(8, ['xo', 'اكس'], 'لعبة XO ضد البوت (.xo 5)', (c) => {
    const key = c.jid + ':' + c.num; const n = parseInt(c.args); let g = xoGames.get(key);
    if (!g || normAr(c.args) === 'جديد') { g = { b: Array(9).fill(null) }; xoGames.set(key, g); if (isNaN(n)) return c.say(`🎮 *XO* — انت ❌ والبوت ⭕\n\n${xoShow(g.b)}\n\nاكتب .xo [1-9]`); }
    if (isNaN(n) || n < 1 || n > 9 || g.b[n - 1]) return c.say(`❌ اختار خانة فاضية من 1 لـ 9\n\n${xoShow(g.b)}`);
    g.b[n - 1] = 'X';
    if (xoWin(g.b, 'X')) { xoGames.delete(key); getUser(c.num).money += 200; saveDB(); return c.say(`${xoShow(g.b)}\n\n🏆 كسبت! +200 جنيه`); }
    if (g.b.every(Boolean)) { xoGames.delete(key); return c.say(`${xoShow(g.b)}\n\n🤝 تعادل`); }
    g.b[xoBot(g.b)] = 'O';
    if (xoWin(g.b, 'O')) { xoGames.delete(key); return c.say(`${xoShow(g.b)}\n\n💀 البوت كسب!`); }
    if (g.b.every(Boolean)) { xoGames.delete(key); return c.say(`${xoShow(g.b)}\n\n🤝 تعادل`); }
    return c.say(`${xoShow(g.b)}\n\nدورك: .xo [1-9]`);
});

// ======================= 9) أدوات =======================
def(9, ['ترجمة', 'ترجمه', 'tr'], 'ترجمة (.ترجمة en مرحبا)', async (c) => {
    let to = null, txt = c.args; if (/^[a-z]{2}(-[a-z]{2})?$/i.test(c.argv[0] || '')) { to = c.argv[0].toLowerCase(); txt = c.argv.slice(1).join(' '); }
    if (!txt) return c.say('🌐 .ترجمة [en/ar/fr..] <النص>');
    const from = /[\u0600-\u06FF]/.test(txt) ? 'ar' : 'en'; to ||= from === 'ar' ? 'en' : 'ar';
    const d = await fetchJson(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(txt)}&langpair=${encodeURIComponent(from + '|' + to)}`);
    const out = d?.responseData?.translatedText; return out && Number(d.responseStatus) === 200 ? c.say(`🌐 *${from} ➜ ${to}*\n\n${out}`) : c.say('❌ فشلت الترجمة');
});
def(9, ['طقس', 'weather'], 'الطقس (.طقس القاهرة)', async (c) => {
    const r = await fetchUrl(`https://wttr.in/${encodeURIComponent(c.args || 'Cairo')}?format=3`, 15000);
    return r.ok ? c.say('☀️ ' + r.body.trim()) : c.say('❌ المدينة غلط — مثال: .طقس Cairo');
});
def(9, ['وقت', 'time'], 'الوقت الحالي (القاهرة)', (c) => c.say(`⏰ ${new Date().toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo' })}`));
def(9, ['تاريخ', 'date'], 'تاريخ اليوم', (c) => c.say(`📅 ${new Date().toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo', dateStyle: 'full' })}`));
def(9, ['حساب', 'calc'], 'آلة حاسبة (.حساب 5*5)', (c) => {
    try {
        const e = c.args.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[x×]/gi, '*').replace(/÷/g, '/').replace(/\^/g, '**');
        if (!e || !/^[0-9+\-*/().%\s]+$/.test(e)) throw 0;
        const r = Function('"use strict";return (' + e + ')')(); if (!Number.isFinite(r)) throw 0;
        return c.say(`🔢 ${e} = ${r}`);
    } catch { return c.say('❌ عملية غلط — مثال: .حساب 5*5'); }
});
def(9, ['بحث', 'جوجل', 'google'], 'رابط بحث جوجل', (c) => (c.args ? c.say(`🔍 *نتيجة البحث عن:* ${c.args}\nhttps://www.google.com/search?q=${encodeURIComponent(c.args)}`) : c.say('🔍 .بحث ميدو الجوهري')));
def(9, ['بروفايل', 'profile'], 'بروفايل كامل (منشن/رقم)', async (c) => {
    const t = targetOf(c.msg, c.args) || c.sender; let pp = null, bio = 'مفيش بايو';
    try { pp = await c.sock.profilePictureUrl(t, 'image'); } catch {}
    try { const st = await c.sock.fetchStatus(t); const s0 = Array.isArray(st) ? st[0] : st; const v = s0?.status?.status ?? s0?.status; if (typeof v === 'string' && v) bio = v; } catch {}
    const cap = withFooter(`👤 *بروفايل*\n📱 +${numOf(t)}\n📝 ${bio}`);
    if (pp) { try { return await c.sock.sendMessage(c.jid, { image: { url: pp }, caption: cap }, { quoted: c.msg }); } catch {} }
    return c.send(cap);
});
def(9, ['اختصار', 'short'], 'اختصار رابط', async (c) => {
    const url = extractUrl(c.args); if (!url) return c.say('🔗 .اختصار <رابط>');
    const r = await fetchUrl('https://is.gd/create.php?format=simple&url=' + encodeURIComponent(url), 15000);
    return r.ok ? c.say('🔗 ' + r.body.trim()) : c.say('❌ فشل الاختصار');
});
def(9, ['تذكير', 'remind'], 'تذكير بعد X دقيقة (.تذكير 10 خبز)', (c) => {
    const m = parseInt(c.argv[0]); const what = c.argv.slice(1).join(' ');
    if (!m || m < 1 || m > 1440 || !what) return c.say('⏰ .تذكير 10 شراء خبز  (بالدقايق)');
    setTimeout(() => sendText(c.sock, c.jid, withFooter(`⏰ *تذكير* @${c.num}\n${what}`), { mentions: [c.sender] }), m * 60000);
    return c.say(`✅ هفكرك بعد ${m} دقيقة (التذكير بيتمسح لو البوت اتعمله ريستارت)`);
});

// ======================= 10) دين =======================
def(10, ['سوره', 'سورة'], 'سورة كاملة (.سوره البقرة أو 2)', async (c) => {
    const q = normAr(c.args); if (!q) return c.say('📖 اكتب: .سوره البقرة او .سوره 2');
    let idx = QURAN_SURAHS.findIndex((s) => normAr(s) === q);
    if (idx === -1) idx = QURAN_SURAHS.findIndex((s) => normAr(s).includes(q) || q.includes(normAr(s)));
    if (idx === -1) { const n = parseInt(q); if (n >= 1 && n <= 114) idx = n - 1; }
    if (idx === -1) return c.say('❌ اسم السورة غلط');
    const name = QURAN_SURAHS[idx]; await c.react('📖');
    const d = await fetchJson(`https://api.alquran.cloud/v1/surah/${idx + 1}`);
    if (!d?.data?.ayahs) return c.say(`📖 *سورة ${name}*\nhttps://quran.com/${idx + 1}`);
    const full = `📖 *سورة ${name}* (${d.data.ayahs.length} آية)\n\n` + d.data.ayahs.map((a) => `${a.text} ﴿${a.numberInSurah}﴾`).join(' ');
    const chunks = full.match(/[\s\S]{1,3800}/g) || [];
    for (let i = 0; i < chunks.length; i++) { await (i === chunks.length - 1 ? c.say(chunks[i]) : c.send(chunks[i])); await sleep(800); }
});
def(10, ['دعاء', 'ادعية'], 'دعاء عشوائي أو بالمناسبة', (c) => {
    const q = normAr(c.args).replace(/^ال/, ''); const key = Object.keys(DUAS).find((k) => normAr(k).replace(/^ال/, '') === q);
    if (!q) return c.say(`🤲 *دعاء*\n\n${rand(DUAS.عام)}\n\nآمين يا رب 🤲`);
    return key ? c.say(`🤲 *دعاء ${key}*\n\n${rand(DUAS[key])}\n\nآمين يا رب 🤲`) : c.say('🤲 .دعاء [الصباح/المساء/السفر/النجاح/الرزق/المريض/الهم]');
});
def(10, ['اذكار', 'ذكر'], 'أذكار الصباح / المساء', (c) => { const q = normAr(c.args); const k = q.includes('مساء') ? 'مساء' : q.includes('صباح') ? 'صباح' : null; return k ? c.say(AZKAR[k].join('\n')) : c.say('اكتب: .اذكار الصباح / .اذكار المساء'); });
def(10, ['اسماء_الله'], 'أسماء الله الحسنى', (c) => c.say(`🕌 *أسماء الله الحسنى*\n\n${NAMES99.map((n, i) => `${i + 1}. ${n}`).join(' • ')}`));

// ======================= 11) ذكاء =======================
const AI_SYSTEM = `أنت ${BOT_NAME} بوت واتساب. أجب بالعربية المصرية البسيطة.`;
async function askAI(q) { const r = await fetchUrl('https://text.pollinations.ai/' + encodeURIComponent(String(q).slice(0, 600)) + '?model=openai&system=' + encodeURIComponent(AI_SYSTEM), 45000); return r.ok && r.body.trim().length > 2 ? r.body.trim() : null; }
def(11, ['ميدو', 'اسأل', 'ذكاء', 'ai'], 'اسأل الذكاء الاصطناعي (.ميدو من انت؟)', async (c) => {
    if (!c.args) return c.say(AZAMA_TEXTS['ميدو'], { mentions: await getHiddenMentions(c.sock, c.jid) });
    await c.react('🧠'); const a = await askAI(c.args); return c.say(a ? `🤖 *${BOT_NAME}* 🧠\n\n${a}` : '❌ الذكاء مش متاح دلوقتي');
});
def(11, ['حكمة', 'حكمه', 'شمشون'], 'حكمة اليوم', (c) => c.say(rand(WISDOMS)));

// ======================= 12) صوتيات =======================
async function voiceFx(c, filter) {
    const { raw, quoted } = quotedOrOwn(c.msg); const target = raw?.audioMessage ? raw : quoted?.audioMessage ? quoted : null;
    if (!target) return c.say('🎙️ رد على فويس نوت بـ .' + c.cmdName);
    await c.say('⏳ بعالج الصوت...');
    const id = `${Date.now()}_${rndNum(0, 999)}`; const inF = path.join(CONFIG.DOWNLOAD_FOLDER, `in_${id}.ogg`); const outF = path.join(CONFIG.DOWNLOAD_FOLDER, `out_${id}.ogg`);
    try {
        fs.writeFileSync(inF, await DL({ message: target }, 'buffer', {}, { logger: P({ level: 'silent' }), reuploadRequest: c.sock.updateMediaMessage }));
        const r = await execCmd('ffmpeg', ['-y', '-i', inF, '-af', filter, '-c:a', 'libopus', '-ar', '48000', outF], 60000);
        if (r.err || !fs.existsSync(outF)) return await c.say('⚠️ ثبت ffmpeg (فيه libopus)');
        await c.sock.sendMessage(c.jid, { audio: fs.readFileSync(outF), mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: c.msg });
    } catch { await c.say('❌ فشل معالجة الصوت'); }
    finally { for (const f of [inF, outF]) try { fs.unlinkSync(f); } catch {} }
}
const pitch = (r) => `aresample=44100,asetrate=44100*${r},aresample=44100,atempo=${(1 / r).toFixed(4)}`;
def(12, ['صوت_بنت'], 'صوت بنت (رد على فويس)', (c) => voiceFx(c, pitch(1.25)));
def(12, ['صوت_رجل'], 'صوت رجل تقيل', (c) => voiceFx(c, pitch(0.8)));
def(12, ['صوت_سنجاب'], 'صوت سنجاب', (c) => voiceFx(c, pitch(1.8)));
def(12, ['صوت_روبوت'], 'صوت روبوت', (c) => voiceFx(c, pitch(0.9) + ',aecho=0.8:0.88:6:0.4'));

// ======================= 13) عظمة =======================
def(13, ['دخول', 'entry'], 'دخول الملك (تحميل متحرك)', async (c) => {
    await animate(c, ['⏳ *_~_جـاري تـسـجـيـل الدخول ⁽₎_* [█▒▒▒▒▒▒▒▒▒] 10%', '⏳ *_~_لسـت كـارف انـها اعـمالي 𝑿x~_* [███▒▒▒▒▒▒▒] 30% 🥂⃢🥃', '⏳ *_~_آنتظࢪ~_* [█████▒▒▒▒▒] 50%', '⏳ *_~_سـيتم آلࢪد فـي آسـ؏ ۄقـت 𝑿x~_* [███████▒▒▒] 70% 🥂⃢🥃', '⏳ *𒁂𓄂ميدوــ𒅌 الجوهري* [█████████▒] 90%', '✅ _*`██████████████]100`*_ تم تحميل قدوم الملك 👑'], 800);
    await sleep(500); await c.say(ENTRY_MESSAGE, { mentions: await getHiddenMentions(c.sock, c.jid) });
});
for (const [k, v] of Object.entries(AZAMA_TEXTS)) {
    if (k === 'ميدو') continue;
    def(13, k, 'عظمة', { noPrefix: true }, async (c) => { if (onCooldown('azama:' + c.jid, CONFIG.AZAMA_COOLDOWN)) return; await c.say(v, { mentions: await getHiddenMentions(c.sock, c.jid) }); });
}

// ======================= 14) الملك والبوت =======================
def(14, ['منيو', 'الاقسام', 'menu'], 'قائمة الأقسام', { ...ALWAYS, noPrefix: true }, (c) => c.send(mainMenu()));
def(14, ['مساعدة', 'help'], 'فتح قسم (.مساعدة 3)', ALWAYS, (c) => { const id = parseInt(c.args); return c.send(SECTIONS[id] ? sectionMenu(id) : mainMenu()); });
def(14, ['اوامر', 'الاوامر'], 'كل الأوامر', { ...ALWAYS, noPrefix: true }, async (c) => { await c.react('📖'); await c.send(withFooter(`👑 *أوامر ${BOT_NAME}* 👑\n\n${ENTRY_MESSAGE}`)); await sleep(800); await c.send(fullMenu()); });
def(14, ['قناة', 'قناه', 'channel'], 'قناة البوت', ALWAYS, (c) => c.say(`📢 *${CHANNEL_NAME}*\nانضم لأعظم مجتمع واتساب 🔥\n👇 ${CHANNEL_URL}`));
def(14, ['المطورين', 'صاحب', 'تعريف'], 'مطورين البوت', ALWAYS, (c) => c.say(`👑 *${BOT_NAME}*\n\n${CONFIG.OWNERS.map((o, i) => `${i === 0 ? '👤 BOSS' : '👑 CO-BOSS'}: wa.me/${o}`).join('\n')}\n\n${CHANNEL_URL}`));
def(14, ['بنج', 'ping'], 'البوت شغال؟', (c) => c.say(`🏓 شغال يا ملك 👑\n⏱️ مدة التشغيل: ${fmtUptime(Date.now() - START_TIME)}`));

// ======================= 15) المطورين =======================
const OW = { owner: true };
def(15, ['اذاعة', 'bc'], 'رسالة لكل الجروبات', OW, async (c) => {
    if (!c.args) return c.say('📢 .اذاعة <الرسالة>');
    let groups = {}; try { groups = await c.sock.groupFetchAllParticipating(); } catch {}
    const ids = Object.keys(groups); await c.say(`📢 بذيع على ${ids.length} جروب...`);
    for (const id of ids) { await sendText(c.sock, id, withFooter(`📢 *إذاعة من الأونر*\n\n${c.args}`)); await sleep(1500); }
    return c.say('✅ تمت الإذاعة');
});
def(15, ['حظر', 'ban'], 'حظر مستخدم من البوت', OW, (c) => {
    const t = targetOf(c.msg, c.args); if (!t) return c.say('🚫 .حظر @منشن'); const n = numOf(t);
    if (isOwner(t)) return c.say('👑 مينفعش تحظر أونر'); DB.banned[n] = true; saveDB(); return c.say(`🚫 تم حظر +${n} من استخدام البوت`);
});
def(15, ['فك_حظر', 'unban', 'فك'], 'فك الحظر', OW, (c) => { const t = targetOf(c.msg, c.args); if (!t) return c.say('✅ .فك_حظر @منشن'); delete DB.banned[numOf(t)]; saveDB(); return c.say(`✅ تم فك حظر +${numOf(t)}`); });
def(15, ['احصائيات', 'stats'], 'إحصائيات البوت', OW, async (c) => {
    let gc = 0; try { gc = Object.keys(await c.sock.groupFetchAllParticipating()).length; } catch {}
    return c.say(`📊 *إحصائيات البوت*\n👥 مستخدمين: ${Object.keys(DB.users).length}\n💬 جروبات: ${gc}\n🚫 محظورين: ${Object.keys(DB.banned).length}\n⚙️ أوامر: ${LIST.length}\n⏱️ تشغيل: ${fmtUptime(Date.now() - START_TIME)}\n✅ الحالة: Stable`);
});
def(15, ['اعادة', 'restart'], 'ريستارت (محتاج pm2/forever)', OW, async (c) => { await c.say('🔄 جاري إعادة التشغيل... (لازم البوت شغال بـ pm2 عشان يرجع لوحده)'); flushDB(); setTimeout(() => process.exit(0), 1500); });

// ======================= المعالج الرئيسي =======================
function autoReply(text) {
    const t = String(text).toLowerCase().trim();
    if (t.includes('سلام عليكم') || t === 'سلام') return withFooter('وعليكم السلام ورحمة الله وبركاته ❤️');
    if (t.includes('ميدو')) return withFooter('👑 الملك ميدو موجود، اؤمر');
    if (t.includes('بوت')) return withFooter(`👑 أنا هنا يا وحش، بوت ${BOT_NAME} تحت أمرك`);
    return '';
}
async function handleMessage(sock, msg) {
    if (!msg?.message || msg.key?.fromMe) return;
    const jid = msg.key?.remoteJid; if (!jid || jid === 'status@broadcast') return;
    const sender = getSender(msg); const num = numOf(sender); const text = getText(msg);
    if (num && DB.banned[num] && !isOwner(sender)) return;
    if (num) { // XP ولفل
        const u = getUser(num); u.msgs++; u.xp++; saveDB();
        if (u.xp >= 50) { u.xp = 0; u.lvl++; sendText(sock, jid, withFooter(`🎊 مبروك @${num} — لفلك بقى ${u.lvl} 👑`), { mentions: [sender] }); }
    }
    if (!text) return;
    const send = (t, extra) => sendText(sock, jid, t, extra);
    const gs = getChat(jid); const getGroup = memo(async () => { if (!isGroup(jid)) return null; try { return await sock.groupMetadata(jid); } catch { return null; } });

    // حماية الروابط
    if (isGroup(jid) && gs.antilink && LINK_REGEX.test(text)) {
        const group = await getGroup();
        if (!canUseAdmin(group, sender)) {
            const botAdm = botIsAdmin(group, sock);
            if (botAdm) { try { await sock.sendMessage(jid, { delete: msg.key }); } catch {} }
            const w = addLinkWarning(jid, num);
            if (w >= 3 && botAdm) { try { await sock.groupParticipantsUpdate(jid, [sender], 'remove'); await send(withFooter(`🚫 @${num} اتطرد (3 لينكات)`), { mentions: [sender] }); resetLinkWarning(jid, num); } catch {} }
            else await send(withFooter(`⚠️ @${num} ممنوع لينكات! ${w}/3`), { mentions: [sender] });
            return;
        }
    }
    // مضاد السبام
    if (isGroup(jid) && gs.antispam && checkFlood(jid, num) >= 6 && !onCooldown('flood:' + jid + ':' + num, 15000)) {
        if (!canUseAdmin(await getGroup(), sender)) await send(withFooter(`⚠️ @${num} بتبعت كتير`), { mentions: [sender] });
    }

    // تحديد الأمر
    let body;
    if (text.startsWith(CONFIG.PREFIX)) body = text.slice(CONFIG.PREFIX.length).trim();
    else {
        if (text.length <= 40) { const a = autoReply(text); if (a) { if (!onCooldown('auto:' + jid, CONFIG.AUTO_REPLY_COOLDOWN)) await send(a); return; } }
        const np = REG.get(normAr(text)); if (!np?.noPrefix) return; body = text;
    }
    const parts = body.split(/\s+/); const cmd = REG.get(normAr(parts[0])); if (!cmd) return;
    const args = body.slice(parts[0].length).trim();
    const c = { sock, jid, msg, sender, num, text, args, argv: args ? args.split(/\s+/) : [], cmdName: parts[0], send, say: (t, extra) => send(withFooter(t), extra), react: (e) => reactTo(sock, jid, msg, e), getGroup, group: null, isOwner: memo(async () => isOwner(sender) || senderIsOwner(await getGroup(), sender)) };

    try {
        if (gs.botLocked && !cmd.always && !(await c.isOwner())) { if (!onCooldown('locked:' + jid + ':' + num, 10000)) await c.say('🔒 *البوت مقفول حاليا*\nالبوت شغال للأونر فقط 👑\nخلي الأونر يكتب: .فتح_البوت'); return; }
        if (cmd.owner && !(await c.isOwner())) return await c.say('❌ للأونر فقط 👑');
        if (cmd.group || cmd.admin || cmd.botAdmin) {
            if (!isGroup(jid)) return await c.say('❌ للمجموعات فقط.');
            c.group = await getGroup(); if (!c.group) return await c.say('❌ مش قادر أجيب بيانات الجروب.');
            if (cmd.admin && !canUseAdmin(c.group, sender)) return await c.say('❌ للمشرفين فقط');
            if (cmd.botAdmin && !botIsAdmin(c.group, sock)) return await c.say('❌ لازم البوت يبقى مشرف');
        }
        await cmd.run(c);
    } catch (e) { console.log(`⚠️ [${cmd.names[0]}]`, e?.message || e); }
}

// ======================= تشغيل البوت =======================
async function startBot() {
    B = await import('@whiskeysockets/baileys'); const pick = (n) => B[n] ?? B.default?.[n];
    const makeWASocket = typeof B.default === 'function' ? B.default : (B.default?.default || B.makeWASocket);
    const useMultiFileAuthState = pick('useMultiFileAuthState'), DisconnectReason = pick('DisconnectReason'), fetchLatestBaileysVersion = pick('fetchLatestBaileysVersion'), Browsers = pick('Browsers');
    DL = pick('downloadMediaMessage');
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.AUTH_FOLDER);
    const cfg = { auth: state, logger: P({ level: 'silent' }), printQRInTerminal: false, browser: Browsers?.ubuntu ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '120.0.0.0'], syncFullHistory: false, markOnlineOnConnect: true };
    try { if (fetchLatestBaileysVersion) { const { version } = await fetchLatestBaileysVersion(); if (version) cfg.version = version; } } catch {}
    const sock = makeWASocket(cfg); sock.ev.on('creds.update', saveCreds);

    let pairing = false;
    const requestPairing = async () => {
        if (pairing || state.creds.registered) return; pairing = true; await sleep(6000);
        const phone = (CONFIG.PHONE_NUMBER || (await ask('[?] Enter Bot Number (with country code): '))).replace(/\D/g, '');
        try { console.log(`\n👑 PAIRING CODE: ${await sock.requestPairingCode(phone)}\n📢 ${CHANNEL_URL}\n`); } catch (e) { console.log(e.message); }
    };
    sock.ev.on('connection.update', async (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'connecting' && !state.creds.registered) requestPairing().catch(() => {});
        if (connection === 'open') console.log(`✅ ${BOT_NAME} ONLINE 👑 — ${LIST.length} أمر\n📢 ${CHANNEL_URL}`);
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) return console.log('🚪 تم تسجيل الخروج — امسح فولدر auth_info_baileys واربط من جديد.');
            await sleep(5000); startBot().catch((e) => console.log(e.message));
        }
    });
    sock.ev.on('messages.upsert', ({ messages, type }) => { if (type !== 'notify') return; for (const m of messages) handleMessage(sock, m).catch((e) => console.log('⚠️', e?.message || e)); });
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
        try { if (!isGroup(id) || action !== 'add' || !getChat(id).welcome) return; for (const p of participants) await sendText(sock, id, withFooter(`🌟 أهلاً @${numOf(p?.id || p)} نورت الجروب 👑`), { mentions: [p?.id || p] }); } catch {}
    });
}
startBot().catch((e) => console.log(e.message));

import Groq from 'groq-sdk';

let cached = null;
export function groq() {
  if (cached) return cached;
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is missing');
  cached = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return cached;
}

const PRIMARY_MODEL = 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `Ты — редактор Telegram-канала "Brooklyn жесть": быстрых сводок о происшествиях в Бруклине на русском языке.

Получив сырое сообщение источника (новость, твит, пост на Reddit, пресс-релиз NYPD, запись из Citizen), извлекаешь факты и составляешь КОРОТКОЕ сообщение для канала.

Правила:
- Отвечай СТРОГО валидным JSON, без markdown.
- title_ru: до 60 символов, без эмодзи.
- body_ru: 2-4 коротких предложения, факты по делу. Без эмодзи. Без воды. Если деталей мало — пиши коротко.
- type: одно из shooting, robbery, fire, arrest, missing, assault, theft, crash, weapon, drugs, suspicious, emergency, other.
- score: 0-100. Серьёзность + достоверность. 80+ = стрельба/пожар/жертвы. 50-70 = ограбление/задержание/нападение. 30-50 = мелкие инциденты, ДТП, подозрительная активность. <30 = слабый сигнал, скорее не публиковать.
- address: адрес или перекрёсток как в источнике (на английском). null если нет.
- landmark: краткий ориентир для русского читателя ("у Key Food на 86-й", "перекрёсток Brighton & Ocean"). Если нет — null.
- occurred_at: ISO-дата если упомянута, иначе null.
- relevant: true если это инцидент в Бруклине ИЛИ напрямую затрагивающий Бруклин ИЛИ NYC-инцидент без явного указания другого района.
- reason_if_irrelevant: краткое объяснение почему false (макс 80 символов).

ЧТО СЧИТАТЬ ИНЦИДЕНТОМ (relevant=true):
- Любое преступление: стрельба, ограбление, кража, нападение, угон, мошенничество с жертвой
- Задержание/арест за серьёзное преступление
- Пожар, ДТП с пострадавшими, обрушение, утечка, прорыв
- Розыск: пропавшие люди, разыскиваемые подозреваемые
- Действия экстренных служб: эвакуация, оцепление, перекрытие из-за инцидента
- Сообщения с полицейских сканеров о текущих вызовах
- Предупреждения о подозрительной активности с указанием места

ЧТО НЕ ЯВЛЯЕТСЯ ИНЦИДЕНТОМ (relevant=false):
- Открытие/закрытие магазинов, ресторанов, парков
- Объявления, общие пресс-релизы без конкретного события
- Культурные/спортивные/развлекательные мероприятия
- Политика, выборы, муниципальные решения без преступного контекста
- Старые судебные приговоры по делам многомесячной давности (если новость только о приговоре, а не о свежем инциденте)
- Общие советы по безопасности без описания произошедшего

ВАЖНО:
- Не выдумывай факты. Если в источнике нет деталей — body_ru короткий.
- НЕ переводи имена улиц на русский. В address оставляй оригинал ("86th Street").
- В landmark можно адаптировать ("86-я стрит у Key Food").
- Если событие в Queens / Bronx / Manhattan / Staten Island — relevant: false.
- Если ты не уверен в районе но событие явно в NYC — пиши район Бруклина если есть зацепки в адресе, иначе ставь relevant: false.
- Пропавшие люди — type: "missing", даже без других деталей, relevant: true.`;

const USER_TEMPLATE = (raw) => `Источник: ${raw.source_name}
URL: ${raw.url || '-'}
Опубликовано: ${raw.published_at || '-'}

Заголовок: ${raw.title || '(нет)'}

Текст:
${raw.body || '(нет)'}

Верни JSON:
{
  "relevant": boolean,
  "reason_if_irrelevant": string|null,
  "type": string,
  "title_ru": string,
  "body_ru": string,
  "address": string|null,
  "landmark": string|null,
  "occurred_at": string|null,
  "score": number
}`;

function extractJson(text) {
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in LLM response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function processRawIncident(raw) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: USER_TEMPLATE(raw) }
  ];

  const tryModel = async (model) => {
    const res = await groq().chat.completions.create({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    });
    const text = res.choices?.[0]?.message?.content || '';
    return extractJson(text);
  };

  try {
    return await tryModel(PRIMARY_MODEL);
  } catch (e) {
    console.warn('[groq] primary model failed, falling back:', e?.message);
    return await tryModel(FALLBACK_MODEL);
  }
}

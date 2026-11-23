// Fiche visuelle des personnages : une seule source pour le modèle low poly du jeu
// et pour les prompts des cinématiques. Les fiches sont générées une fois
// (npm run looks), puis enregistrées dans data/looks.json, où l'on peut les retoucher à la main.

export type HairStyle = "short" | "buzz" | "bald" | "long" | "bob" | "ponytail" | "bun" | "afro" | "braids" | "curly" | "mohawk";
export type Facial = "none" | "stubble" | "beard" | "mustache";
export type Build = "slim" | "average" | "broad" | "round";
export type Hat = "none" | "cap" | "beanie" | "straw" | "fedora" | "bucket" | "toque" | "hardhat" | "helmet" | "headband" | "bandana" | "visor" | "flatcap" | "beekeeper";
export type Top = "tshirt" | "shirt" | "tank" | "jacket" | "hoodie" | "coat" | "apron" | "overalls" | "scrubs" | "suit" | "vest" | "raincoat" | "wetsuit" | "cardigan";
export type Bottom = "pants" | "shorts" | "skirt";
export type Item = "none" | "bag" | "backpack" | "tie" | "headphones" | "camera" | "whistle" | "stethoscope" | "rope" | "toolbelt" | "gloves" | "mask" | "headset" | "medkit" | "scarf" | "dogtags" | "wrench" | "notebook" | "spray";
export type Glasses = "none" | "round" | "square" | "sun";

export interface Look {
  id: string;
  height: number;      // 0.92 à 1.08
  build: Build;
  skin: string;        // couleur (nom de la palette SKIN)
  hair: { style: HairStyle; color: string };
  facial: Facial;
  glasses: Glasses;
  hat: { type: Hat; color: string };
  top: { type: Top; color: string };
  bottom: { type: Bottom; color: string };
  item: { type: Item; color: string };
  signature: string;   // ce qui le rend reconnaissable au premier coup d'œil (FR)
  face?: Face;         // détails du visage, utilisés par les prompts des cinématiques
}

export interface Face { shape: string; eyes: string; feature: string; expression: string }

// Palettes : un nom anglais précis (pour les prompts) et sa couleur.
export const SKIN: Record<string, string> = {
  "porcelain": "#f6d3b3", "light beige": "#e9b48f", "warm tan": "#c98e62",
  "golden brown": "#a86b45", "deep brown": "#7b4a2d", "dark ebony": "#563220",
};
export const HAIR: Record<string, string> = {
  "jet black": "#1d1512", "dark brown": "#3b2418", "chestnut": "#6b3e1f", "copper red": "#a33b2b",
  "honey blond": "#d9b36c", "ash blond": "#c8b88f", "silver grey": "#8a8f99", "snow white": "#e8e8e8",
  "electric blue": "#2f6fd6", "pastel pink": "#f2a2c0",
};
export const CLOTH: Record<string, string> = {
  "tangerine orange": "#ff8a3d", "mint green": "#62d6a0", "sand beige": "#e9cf98", "sky blue": "#7fb0ff",
  "coral red": "#ff5b6b", "lavender": "#c08bff", "white": "#f2f2f2", "charcoal": "#2b2b35",
  "navy blue": "#1d3557", "olive green": "#5b6b2f", "khaki": "#c8a165", "mustard yellow": "#ffc43d",
  "teal": "#2a9d8f", "burgundy": "#7a1f2b", "hot pink": "#ff4fa3", "denim blue": "#3a5a8a",
  "forest green": "#2f5f3a", "chocolate brown": "#6b4a2e", "fire red": "#d62828", "safety yellow": "#e8ff3d",
  "slate grey": "#5a6470", "cream": "#f4ead2", "black": "#18181c", "plum": "#5e2b5c",
};

interface Outfit { top: Top[]; bottom?: Bottom[]; hat: Hat[]; item: Item[]; colors: string[]; fixed?: Partial<Record<"top" | "hat" | "item", string>>; sig: string }

// Tenue de base par métier : le métier se lit sur la silhouette.
const OUTFITS: Record<string, Outfit> = {
  "bike courier": { top: ["tshirt", "jacket"], bottom: ["shorts"], hat: ["cap"], item: ["bag"], colors: ["mustard yellow", "tangerine orange", "teal", "hot pink"], sig: "sacoche de coursier en bandoulière" },
  "mountain guide": { top: ["jacket"], hat: ["beanie"], item: ["rope"], colors: ["fire red", "tangerine orange", "teal", "navy blue"], sig: "corde enroulée sur l'épaule et bonnet" },
  "dancer": { top: ["tank"], hat: ["headband"], item: ["none"], colors: ["hot pink", "lavender", "mint green", "black"], sig: "bandeau et débardeur de danse" },
  "head chef": { top: ["coat"], hat: ["toque"], item: ["scarf"], colors: ["white"], fixed: { top: "white", hat: "white" }, sig: "toque et veste de chef" },
  "farmer": { top: ["overalls"], hat: ["straw"], item: ["none"], colors: ["denim blue", "forest green", "chocolate brown"], fixed: { hat: "sand beige" }, sig: "salopette et chapeau de paille" },
  "poker player": { top: ["vest"], hat: ["visor"], item: ["none"], colors: ["burgundy", "black", "forest green"], sig: "visière de croupier et lunettes noires" },
  "stunt performer": { top: ["jacket"], hat: ["none"], item: ["gloves"], colors: ["fire red", "black", "mustard yellow"], sig: "blouson de cuir et gants" },
  "taxi driver": { top: ["shirt"], hat: ["flatcap"], item: ["none"], colors: ["mustard yellow", "slate grey", "sky blue"], sig: "casquette plate de chauffeur" },
  "fisherman": { top: ["raincoat"], hat: ["bucket"], item: ["none"], colors: ["mustard yellow", "tangerine orange", "navy blue"], sig: "ciré et bob de pêcheur" },
  "travel influencer": { top: ["shirt"], bottom: ["shorts"], hat: ["none", "cap"], item: ["camera"], colors: ["hot pink", "mint green", "sky blue"], sig: "chemise à fleurs et appareil photo" },
  "PE teacher": { top: ["jacket"], hat: ["none", "cap"], item: ["whistle"], colors: ["fire red", "navy blue", "mint green"], sig: "survêtement et sifflet" },
  "archaeologist": { top: ["shirt"], hat: ["fedora"], item: ["backpack"], colors: ["khaki", "sand beige"], fixed: { hat: "chocolate brown" }, sig: "chapeau d'aventurier et sac à dos" },
  "lawyer": { top: ["suit"], hat: ["none"], item: ["tie"], colors: ["charcoal", "navy blue", "slate grey"], sig: "costume et cravate" },
  "army veteran": { top: ["tank"], hat: ["bandana", "cap"], item: ["dogtags"], colors: ["olive green"], fixed: { top: "olive green" }, sig: "débardeur kaki et plaques militaires" },
  "waitress": { top: ["apron"], hat: ["none"], item: ["notebook"], colors: ["black", "burgundy", "teal"], sig: "tablier de service et carnet de commandes" },
  "real estate agent": { top: ["suit"], hat: ["none"], item: ["tie"], colors: ["sand beige", "sky blue", "cream"], sig: "costume clair et cravate" },
  "engineer": { top: ["vest"], hat: ["hardhat"], item: ["none"], colors: ["safety yellow", "tangerine orange"], fixed: { hat: "mustard yellow" }, sig: "casque de chantier et gilet fluo" },
  "paramedic": { top: ["jacket"], hat: ["none"], item: ["medkit"], colors: ["forest green", "fire red"], sig: "uniforme d'ambulancier et trousse" },
  "boxing coach": { top: ["hoodie"], hat: ["none", "cap"], item: ["gloves"], colors: ["fire red", "black", "navy blue", "plum", "slate grey"], sig: "sweat à capuche et gants de boxe" },
  "night nurse": { top: ["scrubs"], hat: ["none"], item: ["stethoscope"], colors: ["teal", "sky blue", "lavender"], sig: "blouse d'infirmier·e et stéthoscope" },
  "baker": { top: ["apron"], hat: ["bandana"], item: ["none"], colors: ["white", "cream"], sig: "tablier enfariné et bandana" },
  "primary school teacher": { top: ["cardigan"], hat: ["none"], item: ["notebook"], colors: ["mustard yellow", "lavender", "mint green", "coral red"], sig: "gilet en laine et cahier" },
  "veterinarian": { top: ["scrubs"], hat: ["none"], item: ["stethoscope"], colors: ["mint green", "teal", "sky blue"], sig: "blouse verte et stéthoscope" },
  "carpenter": { top: ["shirt"], hat: ["none", "cap"], item: ["toolbelt"], colors: ["fire red", "forest green", "chocolate brown"], sig: "chemise à carreaux et ceinture à outils" },
  "video game developer": { top: ["hoodie"], hat: ["none"], item: ["headphones"], colors: ["sky blue", "lavender", "black"], sig: "sweat à capuche et casque audio" },
  "psychologist": { top: ["cardigan"], hat: ["none"], item: ["notebook"], colors: ["cream", "plum", "slate grey"], sig: "col roulé et carnet de notes" },
  "marine biologist": { top: ["wetsuit"], hat: ["none"], item: ["mask"], colors: ["teal", "black", "navy blue"], sig: "combinaison et masque de plongée sur le front" },
  "volunteer firefighter": { top: ["jacket"], hat: ["helmet"], item: ["none"], colors: ["sand beige", "chocolate brown"], fixed: { hat: "fire red" }, sig: "veste à bandes jaunes et casque rouge" },
  "DIY YouTuber": { top: ["shirt"], hat: ["cap"], item: ["toolbelt"], colors: ["fire red", "denim blue", "mustard yellow", "teal"], sig: "casquette, chemise à carreaux et outils" },
  "wildlife photographer": { top: ["vest"], hat: ["bucket"], item: ["camera"], colors: ["khaki", "olive green"], sig: "gilet multipoches et téléobjectif" },
  "drone pilot": { top: ["jacket"], hat: ["none"], item: ["headset"], colors: ["slate grey", "black", "tangerine orange"], sig: "blouson et casque radio" },
  "street artist": { top: ["hoodie"], hat: ["beanie"], item: ["spray"], colors: ["hot pink", "mustard yellow", "mint green"], sig: "sweat taché de peinture et bombe aérosol" },
  "mechanic": { top: ["overalls"], hat: ["cap"], item: ["wrench"], colors: ["navy blue", "slate grey"], sig: "combinaison de garagiste et clé à molette" },
  "librarian": { top: ["cardigan"], hat: ["none"], item: ["scarf"], colors: ["burgundy", "forest green", "mustard yellow"], sig: "gilet, écharpe et lunettes rondes" },
  "accountant": { top: ["shirt"], hat: ["none"], item: ["tie"], colors: ["white", "sky blue"], sig: "chemise, cravate et lunettes" },
  "DJ": { top: ["jacket"], hat: ["none", "cap"], item: ["headphones"], colors: ["black", "hot pink", "lavender"], sig: "bomber, casque de DJ et lunettes noires" },
  "lifeguard": { top: ["tank"], bottom: ["shorts"], hat: ["visor"], item: ["whistle"], colors: ["fire red"], fixed: { top: "fire red" }, sig: "débardeur rouge de sauveteur et sifflet" },
  "beekeeper": { top: ["coat"], hat: ["beekeeper"], item: ["none"], colors: ["white", "cream"], sig: "combinaison blanche et chapeau à voilette" },
};

// Teint plausible selon la ville d'origine (les grandes villes restent très mélangées).
const ORIGIN_SKIN: [RegExp, number[]][] = [
  [/Accra|Lagos|Dakar|Abidjan/, [3, 4, 5, 5, 4]],
  [/Mumbai/, [2, 3, 3, 4]],
  [/Seoul|Osaka/, [0, 1, 1]],
  [/Tunis|Casablanca|Istanbul|Mexico|São Paulo|Buenos Aires|Nouméa/, [1, 2, 2, 3, 4]],
  [/Reykjavik|Stockholm|Kraków|Dublin/, [0, 0, 1, 2]],
  [/./, [0, 1, 2, 3, 4, 5]],
];

function rngFor(id: string) {
  let h = [...id].reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) >>> 0, 2166136261);
  return () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = <T>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length)];

export interface CharLite { id: string; age: number; gender: string; origin: { en: string }; job: { en: string }; traits?: Record<string, number> }

export function makeLook(c: CharLite): Look {
  const r = rngFor(c.id);
  const o = OUTFITS[c.job.en] ?? OUTFITS["PE teacher"];
  const skinNames = Object.keys(SKIN);
  const skin = skinNames[pick(r, ORIGIN_SKIN.find(([re]) => re.test(c.origin.en))![1])];
  const f = c.gender === "f", m = c.gender === "m";
  const style: HairStyle = pick(r, f ? ["long", "bob", "ponytail", "bun", "afro", "braids", "curly", "short", "long"]
    : m ? ["short", "buzz", "short", "curly", "afro", "mohawk", "ponytail", c.age > 40 ? "bald" : "buzz", c.age > 45 ? "bald" : "short"]
    : ["short", "bob", "curly", "mohawk", "buzz", "braids", "ponytail"]);
  const dark = ["jet black", "dark brown", "chestnut"], all = ["jet black", "dark brown", "chestnut", "copper red", "honey blond", "ash blond"];
  let hair = pick(r, skin === "porcelain" || skin === "light beige" ? all : dark);
  if (c.age >= 55 ? r() < 0.75 : c.age >= 45 && r() < 0.3) hair = pick(r, ["silver grey", "snow white", "silver grey"]);
  if (c.age < 32 && r() < 0.12) hair = pick(r, ["electric blue", "pastel pink"]);
  const facial: Facial = m ? pick(r, ["none", "none", "stubble", "beard", "mustache", "beard"]) : c.gender === "x" && r() < 0.15 ? "stubble" : "none";
  const glasses: Glasses = /poker|DJ/.test(c.job.en) ? "sun" : /lawyer|accountant|librarian|psychologist|developer/.test(c.job.en) ? pick(r, ["round", "square", "none"])
    : r() < (c.age > 50 ? 0.35 : 0.12) ? pick(r, ["round", "square"]) : "none";
  const col = pick(r, o.colors);
  const hatType = pick(r, o.hat);
  const neutral = ["charcoal", "denim blue", "khaki", "slate grey", "black", "chocolate brown", "sand beige"];
  const accent = Object.keys(CLOTH).filter((k) => k !== col && !neutral.includes(k));
  return {
    id: c.id,
    height: Math.round((0.94 + r() * 0.12 + (m ? 0.02 : f ? -0.02 : 0)) * 100) / 100,
    build: pick(r, c.age > 50 ? ["average", "round", "broad", "slim"] : ["slim", "average", "broad", "average"]),
    skin,
    hair: { style, color: hair },
    facial, glasses,
    hat: { type: hatType, color: o.fixed?.hat ?? pick(r, accent) },
    top: { type: pick(r, o.top), color: o.fixed?.top ?? col },
    bottom: { type: pick(r, o.bottom ?? (f ? ["pants", "pants", "skirt", "shorts"] : ["pants", "pants", "shorts"])), color: pick(r, neutral.filter((n) => n !== col)) },
    item: { type: pick(r, o.item), color: pick(r, accent) },
    signature: o.sig,
  };
}

// Deux personnages ne doivent pas se ressembler : on compare ce qui se voit de loin.
export const silhouetteKey = (l: Look) => [l.hair.style, l.hair.color, l.hat.type, l.top.type, l.top.color].join("|");

const HAIR_EN: Record<HairStyle, string> = {
  short: "short neat hair", buzz: "buzz cut", bald: "shaved bald head", long: "long straight hair falling past the shoulders",
  bob: "chin-length bob", ponytail: "high ponytail", bun: "top bun", afro: "rounded afro", braids: "long box braids",
  curly: "voluminous curly hair", mohawk: "short mohawk",
};
const HAT_EN: Record<Hat, string> = {
  none: "", cap: "baseball cap", beanie: "knitted beanie", straw: "wide straw hat", fedora: "adventurer fedora",
  bucket: "bucket hat", toque: "tall chef's toque", hardhat: "construction hard hat", helmet: "firefighter helmet",
  headband: "sports headband", bandana: "tied bandana", visor: "sun visor", flatcap: "flat cap", beekeeper: "beekeeper hat with mesh veil",
};
const TOP_EN: Record<Top, string> = {
  tshirt: "t-shirt", shirt: "short-sleeved button shirt", tank: "tank top", jacket: "zip jacket", hoodie: "hoodie",
  coat: "long work coat", apron: "apron over a t-shirt", overalls: "work overalls", scrubs: "medical scrubs",
  suit: "suit jacket", vest: "sleeveless vest over a t-shirt", raincoat: "fisherman's raincoat", wetsuit: "short wetsuit top", cardigan: "knitted cardigan",
};
const ITEM_EN: Record<Item, string> = {
  none: "", bag: "messenger bag across the chest", backpack: "canvas backpack", tie: "necktie", headphones: "over-ear headphones around the neck",
  camera: "camera on a strap", whistle: "whistle on a lanyard", stethoscope: "stethoscope around the neck", rope: "coiled climbing rope over one shoulder",
  toolbelt: "tool belt", gloves: "boxing gloves hanging from the neck", mask: "diving mask pushed up on the forehead", headset: "radio headset",
  medkit: "first-aid bag", scarf: "scarf", dogtags: "military dog tags", wrench: "large wrench in hand", notebook: "small notebook in hand", spray: "spray paint can in hand",
};
const BUILD_EN: Record<Build, string> = { slim: "slim", average: "average build", broad: "broad-shouldered", round: "stocky and round" };
const FACIAL_EN: Record<Facial, string> = { none: "", stubble: "light stubble", beard: "full beard", mustache: "thick mustache" };
const GLASSES_EN: Record<Glasses, string> = { none: "", round: "round glasses", square: "square glasses", sun: "dark sunglasses" };

// Prompt anglais stable, à réutiliser tel quel dans les outils 3D, image ou vidéo.
export function lookPrompt(c: CharLite & { name: string }, l: Look): string {
  const who = c.gender === "f" ? "woman" : c.gender === "m" ? "man" : "androgynous person";
  const hex = (k: string) => `${k} (${(CLOTH[k] ?? HAIR[k] ?? SKIN[k]).toUpperCase()})`;
  const parts = [
    `${c.name}, a ${c.age}-year-old ${who}, ${c.job.en} from ${c.origin.en}`,
    `${BUILD_EN[l.build]}, ${l.height >= 1.03 ? "tall" : l.height <= 0.96 ? "short" : "medium height"}`,
    `${hex(l.skin)} skin`,
    l.hair.style === "bald" ? "shaved bald head" : `${HAIR_EN[l.hair.style]}, ${hex(l.hair.color)}`,
    FACIAL_EN[l.facial] && (l.facial !== "none" && l.hair.style !== "bald" ? `${FACIAL_EN[l.facial]} matching the hair` : FACIAL_EN[l.facial]),
    GLASSES_EN[l.glasses],
    HAT_EN[l.hat.type] && `${hex(l.hat.color)} ${HAT_EN[l.hat.type]}`,
    `${hex(l.top.color)} ${TOP_EN[l.top.type]}`,
    `${hex(l.bottom.color)} ${l.bottom.type}`,
    ITEM_EN[l.item.type] && `${hex(l.item.color)} ${ITEM_EN[l.item.type]}`,
  ].filter(Boolean);
  return `Stylized low-poly 3D character, flat-shaded faceted look, chunky friendly proportions (slightly big head, simple hands), family-friendly reality-show style. ${parts.join("; ")}. Full body, A-pose, front, side and back views, plain light grey background, soft studio lighting, no text, no logo.`;
}

// Fiche avec les couleurs en hexadécimal, pour la démo.
export function resolveLook(l: Look) {
  const hx = (k: string) => CLOTH[k] ?? HAIR[k] ?? SKIN[k] ?? k;
  return {
    height: l.height, build: l.build, skin: hx(l.skin), facial: l.facial, glasses: l.glasses,
    hair: { style: l.hair.style, color: hx(l.hair.color) },
    hat: { type: l.hat.type, color: hx(l.hat.color) },
    top: { type: l.top.type, color: hx(l.top.color) },
    bottom: { type: l.bottom.type, color: hx(l.bottom.color) },
    item: { type: l.item.type, color: hx(l.item.color) },
  };
}

// ---------- Visage et prompt « cinématique » ----------
const SHAPES = ["oval face", "round face", "square jaw", "heart-shaped face", "long face with high cheekbones", "soft round cheeks"];
const FEATURES = ["freckles across the nose", "deep dimples", "a small beauty mark on the cheek", "thick expressive eyebrows", "a slightly crooked nose",
  "a gap-toothed smile", "laugh lines around the eyes", "a tiny scar through one eyebrow", "big bright eyes", "a strong straight nose", "sun-kissed cheeks", "long eyelashes"];
const EXPRESSION: Record<string, [string, string]> = {
  courage: ["a fearless, confident grin", "a wary, hesitant look"],
  empathy: ["a warm, kind smile", "a cool, unreadable face"],
  cunning: ["a sly, knowing half-smile", "an open, trusting expression"],
  loyalty: ["a steady, dependable look", "a restless, opportunistic glint in the eyes"],
  composure: ["a calm, relaxed expression", "a nervous, fidgety smile"],
};

export function makeFace(c: CharLite, l: Look): Face {
  const r = rngFor(c.id + "face");
  const darkSkin = ["golden brown", "deep brown", "dark ebony"].includes(l.skin);
  const eyes = pick(r, darkSkin ? ["dark brown", "deep brown", "warm brown", "hazel"] : ["brown", "hazel", "green", "blue", "grey", "dark brown", "amber"]);
  const t = Object.entries(c.traits ?? { empathy: 60 }).sort((a, b) => b[1] - a[1]);
  const [top, val] = t[0], low = t[t.length - 1];
  const expression = val >= 70 || !low ? EXPRESSION[top]?.[0] ?? "a friendly smile" : EXPRESSION[low[0]]?.[1] ?? "a friendly smile";
  return { shape: pick(r, SHAPES), eyes: `${eyes} eyes`, feature: c.age > 55 ? pick(r, ["laugh lines around the eyes", "deep wrinkles from years of smiling", "weathered sun-tanned skin", ...FEATURES.slice(0, 4)]) : pick(r, FEATURES), expression };
}

const CINE_TOP: Record<Top, string> = {
  tshirt: "fitted cotton t-shirt", shirt: "short-sleeved button shirt with rolled sleeves", tank: "athletic tank top", jacket: "lightweight zip jacket",
  hoodie: "soft hoodie with the sleeves pushed up", coat: "long tailored work coat", apron: "canvas apron over a t-shirt", overalls: "worn denim-style overalls over a t-shirt",
  scrubs: "medical scrubs", suit: "sharp tailored suit jacket over an open-collar shirt", vest: "utility vest over a t-shirt", raincoat: "glossy fisherman's raincoat",
  wetsuit: "short-sleeved wetsuit top", cardigan: "cosy knitted cardigan over a shirt",
};

// Prompt pour la planche de référence des cinématiques : 3D stylisée haut de gamme, belle et fun.
export function cinePrompt(c: CharLite & { name: string }, l: Look): string {
  const f = l.face ?? makeFace(c, l);
  const who = c.gender === "f" ? "woman" : c.gender === "m" ? "man" : "androgynous non-binary person";
  const col = (k: string) => k;
  const hair = l.hair.style === "bald" ? "a clean shaved head" : `${col(l.hair.color)} ${HAIR_EN[l.hair.style]}`;
  const parts = [
    `${c.name}, a ${c.age}-year-old ${who}, ${c.job.en} from ${c.origin.en}`,
    `${BUILD_EN[l.build]}, ${l.height >= 1.03 ? "tall" : l.height <= 0.96 ? "short" : "medium height"}`,
    `${l.skin} skin, ${f.shape}, ${f.eyes}, ${f.feature}, ${f.expression}`,
    hair,
    l.facial !== "none" && FACIAL_EN[l.facial],
    l.glasses !== "none" && GLASSES_EN[l.glasses],
    l.hat.type !== "none" && `${col(l.hat.color)} ${HAT_EN[l.hat.type]}`,
    `${col(l.top.color)} ${CINE_TOP[l.top.type]}`,
    `${col(l.bottom.color)} ${l.bottom.type}`,
    l.item.type !== "none" && `signature accessory: ${col(l.item.color)} ${ITEM_EN[l.item.type]}`,
    "clothes slightly sun-faded and sandy after days on a tropical island",
  ].filter(Boolean);
  return `High-end stylized 3D character for an animated reality-show cinematic: modern animated feature film quality, appealing slightly exaggerated proportions, expressive face with lifelike eyes, detailed skin, hair and fabric textures, vibrant colors, cinematic rim lighting, fun and charismatic, family-friendly. ${parts.join("; ")}. Character reference sheet of the same person: full body front, side and back views in a relaxed A-pose, plus a close-up portrait of the face; consistent design in every view; plain light grey background; no text, no logo, no watermark.`;
}

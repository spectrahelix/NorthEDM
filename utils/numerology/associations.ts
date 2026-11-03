// Curated, sourced associations. Small on purpose: every entry names its
// tradition and source. A number or date with nothing here gets an explicit
// "no additional sourced association verified" row — never an invented one.

export type Source = { id: string; label: string; site: string; url?: string };

export const SOURCES: Record<string, Source> = {
  hebcal: { id: "hebcal", label: "Hebcal: Hebrew date converter and holidays", site: "hebcal.com", url: "https://www.hebcal.com/converter" },
  chai: { id: "chai", label: "Chabad: Chai and multiples of 18", site: "chabad.org", url: "https://www.chabad.org/library/article_cdo/aid/484894/jewish/What-is-the-reason-giving-money-in-multiples-of-18.htm" },
  fifteen: { id: "fifteen", label: "Beth Emunah: why 15 and 16 are written ט״ו and ט״ז", site: "betemunah.org", url: "https://www.betemunah.org/fifteen.html" },
  shabbatQueen: { id: "shabbatQueen", label: "Chabad: Shabbat as bride and queen", site: "chabad.org", url: "https://www.chabad.org/library/article_cdo/aid/3753326/jewish/Four-Reasons-Shabbat-Is-Compared-to-Bride-and-a-Queen.htm" },
  genesis1: { id: "genesis1", label: "Genesis 1:1–2:3, the days of creation", site: "biblehub.com", url: "https://biblehub.com/genesis/1-1.htm" },
  jeZodiac: { id: "jeZodiac", label: "Jewish Encyclopedia (1906): Zodiac", site: "jewishencyclopedia.com", url: "https://www.jewishencyclopedia.com/articles/15277-zodiac.html" },
  mayimZodiac: { id: "mayimZodiac", label: "Mayim Achronim: Constellations and the Jewish calendar", site: "mayimachronim.com", url: "https://www.mayimachronim.com/?p=8668" },
  tuBav: { id: "tuBav", label: "OU: Tu B'Av and Mishnah Taanit 4:8", site: "ou.org", url: "https://ou.org/holidays/tu_bav" },
  astronomyEngine: { id: "astronomyEngine", label: "Astronomy Engine (MIT) by Don Cross", site: "github.com/cosinekitty/astronomy", url: "https://github.com/cosinekitty/astronomy" },
  osm: { id: "osm", label: "Place search: © OpenStreetMap contributors (Nominatim)", site: "openstreetmap.org", url: "https://www.openstreetmap.org/copyright" },
};

// ---------- numbers ----------

export type NumberAssociation = {
  hebrew?: string;
  pronunciation?: string;
  meaning: string;
  tradition: string;
  sourceIds: string[];
};

export const NUMBER_ASSOCIATIONS: Record<number, NumberAssociation> = {
  18: { hebrew: "חי", pronunciation: "chai", meaning: "Life; gifts in multiples of 18 are a familiar Jewish wish for life.", tradition: "Jewish custom", sourceIds: ["chai"] },
  15: { hebrew: "יה", pronunciation: "Yah", meaning: "A short form of the divine name. Because יה totals 15, the 15th is customarily written ט״ו (9 + 6).", tradition: "Jewish writing custom", sourceIds: ["fifteen"] },
  16: { meaning: "Written ט״ז (9 + 7) rather than י״ו, which resembles part of the divine name.", tradition: "Jewish writing custom", sourceIds: ["fifteen"] },
};

// ---------- weekdays (Genesis 1) ----------

export const WEEKDAY_CONTEXT: Array<{ figure: string; explanation: string; extra?: { figure: string; tradition: string; explanation: string; sourceIds: string[] } }> = [
  { figure: "Light", explanation: "First day of creation: light is separated from darkness (Genesis 1:3–5)." },
  { figure: "The sky", explanation: "Second day: the firmament separates the waters above from the waters below (Genesis 1:6–8)." },
  { figure: "Land and plants", explanation: "Third day: dry land appears and plants begin to grow (Genesis 1:9–13)." },
  { figure: "The great lights", explanation: "Fourth day: the sun, moon and stars are set in the sky to mark seasons, days and years (Genesis 1:14–19)." },
  { figure: "Fish and birds", explanation: "Fifth day: creatures of the sea and the air (Genesis 1:20–23)." },
  { figure: "Animals and humankind", explanation: "Sixth day: land animals, and humankind made in the image of God (Genesis 1:24–31)." },
  {
    figure: "Rest",
    explanation: "Seventh day: God rests and blesses the day (Genesis 2:1–3).",
    extra: { figure: "Shekhinah", tradition: "Jewish Kabbalah", explanation: "God's indwelling presence, welcomed as the Sabbath Queen or Bride.", sourceIds: ["shabbatQueen"] },
  },
];

// ---------- Hebrew month signs ----------
// The traditional correspondence of the twelve months with the twelve signs
// (Talmudic period; Sefer Yetzirah). A leap year's Adar I and Adar II both
// belong to Dagim. This is NOT the person's calculated Western Sun sign.

export const MONTH_SIGNS: Record<string, { hebrew: string; name: string; western: string }> = {
  Nisan: { hebrew: "טלה", name: "Taleh, the lamb", western: "Aries" },
  Iyyar: { hebrew: "שור", name: "Shor, the bull", western: "Taurus" },
  Sivan: { hebrew: "תאומים", name: "Te'omim, the twins", western: "Gemini" },
  Tamuz: { hebrew: "סרטן", name: "Sartan, the crab", western: "Cancer" },
  Av: { hebrew: "אריה", name: "Aryeh, the lion", western: "Leo" },
  Elul: { hebrew: "בתולה", name: "Betulah, the maiden", western: "Virgo" },
  Tishrei: { hebrew: "מאזניים", name: "Moznayim, the scales", western: "Libra" },
  Cheshvan: { hebrew: "עקרב", name: "Akrav, the scorpion", western: "Scorpio" },
  Kislev: { hebrew: "קשת", name: "Keshet, the bow", western: "Sagittarius" },
  Tevet: { hebrew: "גדי", name: "Gedi, the kid", western: "Capricorn" },
  "Sh'vat": { hebrew: "דלי", name: "D'li, the bucket", western: "Aquarius" },
  Adar: { hebrew: "דגים", name: "Dagim, the fish", western: "Pisces" },
  "Adar I": { hebrew: "דגים", name: "Dagim, the fish", western: "Pisces" },
  "Adar II": { hebrew: "דגים", name: "Dagim, the fish", western: "Pisces" },
};

export const OBSERVANCE_NOTES: Record<string, { explanation: string; sourceIds: string[] }> = {
  "Tu B'Av": {
    explanation: "Mishnah Taanit 4:8 names 15 Av and Yom Kippur as the most joyous days of the year; today it is a day of love and matchmaking.",
    sourceIds: ["tuBav"],
  },
};

export const INTERPRETIVE_NOTE =
  "Astrology and numerology are interpretive traditions for reflection, not scientifically validated predictions.";

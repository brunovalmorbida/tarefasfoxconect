export const UNASSIGNED = "Aguardando distribuição";

export type CityKey = "sao-jose-do-ouro" | "passo-fundo" | "pontao" | "lagoa-vermelha";

export interface CityConfig {
  key: CityKey;
  name: string;
  technicians: string[];
  /** semantic token classes for the city badge */
  badgeClass: string;
  accentClass: string;
}

export const CITIES: CityConfig[] = [
  {
    key: "sao-jose-do-ouro",
    name: "São José do Ouro",
    technicians: ["Renan", "Pedro", "Alan", "Gian"],
    badgeClass: "bg-city-ouro/15 text-city-ouro border-city-ouro/30",
    accentClass: "border-l-city-ouro",
  },
  {
    key: "passo-fundo",
    name: "Passo Fundo",
    technicians: ["Luis", "Alcir", "Fabricio", "Eliseu"],
    badgeClass: "bg-city-passo/15 text-city-passo border-city-passo/30",
    accentClass: "border-l-city-passo",
  },
  {
    key: "pontao",
    name: "Pontão",
    technicians: ["Edson", "Ralf"],
    badgeClass: "bg-city-pontao/15 text-city-pontao border-city-pontao/30",
    accentClass: "border-l-city-pontao",
  },
  {
    key: "lagoa-vermelha",
    name: "Lagoa Vermelha",
    technicians: [],
    badgeClass: "bg-city-lagoa/15 text-city-lagoa border-city-lagoa/30",
    accentClass: "border-l-city-lagoa",
  },
];

export const getCity = (name?: string | null) =>
  CITIES.find((c) => c.name === name) ?? CITIES[0];

/** Todos os técnicos, de todas as cidades */
export const ALL_TECHNICIANS = CITIES.flatMap((c) => c.technicians);

export interface Weekday {
  value: number; // 1 = segunda ... 6 = sábado
  label: string;
  short: string;
}

export const WEEKDAYS: Weekday[] = [
  { value: 1, label: "Segunda", short: "SEG" },
  { value: 2, label: "Terça", short: "TER" },
  { value: 3, label: "Quarta", short: "QUA" },
  { value: 4, label: "Quinta", short: "QUI" },
  { value: 5, label: "Sexta", short: "SEX" },
  { value: 6, label: "Sábado", short: "SÁB" },
];

export const getWeekday = (value?: number | null) =>
  WEEKDAYS.find((w) => w.value === value) ?? WEEKDAYS[0];

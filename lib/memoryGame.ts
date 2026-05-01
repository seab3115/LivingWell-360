import { Ionicons } from "@expo/vector-icons";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface WeeklyTheme {
  title: string;
  icons: IoniconName[];
}

const themes: WeeklyTheme[] = [
  {
    title: "Animals",
    icons: ["paw", "fish", "bug", "leaf", "rose", "flower"],
  },
  {
    title: "Travel",
    icons: ["airplane", "boat", "car", "bicycle", "train", "rocket"],
  },
  {
    title: "Food",
    icons: ["pizza", "ice-cream", "cafe", "wine", "restaurant", "nutrition"],
  },
  {
    title: "Weather",
    icons: ["sunny", "cloud", "rainy", "snow", "thunderstorm", "moon"],
  },
  {
    title: "Music",
    icons: ["musical-note", "musical-notes", "headset", "mic", "radio", "disc"],
  },
  {
    title: "Sports",
    icons: ["football", "basketball", "tennisball", "baseball", "bicycle", "fitness"],
  },
];

function weekOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = (d.getTime() - start.getTime()) / 86400000;
  return Math.floor(diff / 7);
}

export interface WeeklyGame {
  title: string;
  weekNumber: number;
  pairs: IoniconName[];
}

export function getCurrentWeekGame(): WeeklyGame {
  const now = new Date();
  const week = weekOfYear(now);
  const theme = themes[week % themes.length];
  return {
    title: theme.title,
    weekNumber: week,
    pairs: theme.icons,
  };
}

export interface MemoryCard {
  id: number;
  icon: IoniconName;
  flipped: boolean;
  matched: boolean;
}

export function buildDeck(pairs: IoniconName[]): MemoryCard[] {
  const deck: MemoryCard[] = [];
  pairs.forEach((icon, i) => {
    deck.push({ id: i * 2, icon, flipped: false, matched: false });
    deck.push({ id: i * 2 + 1, icon, flipped: false, matched: false });
  });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

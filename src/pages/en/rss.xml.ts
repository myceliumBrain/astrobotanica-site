// /en/rss.xml — notícias traduzidas (ver src/lib/rss.ts).
import { feedNoticias } from "../../lib/rss";

export const GET = () => feedNoticias("en");

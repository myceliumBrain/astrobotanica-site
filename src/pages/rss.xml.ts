// /rss.xml — notícias em português (ver src/lib/rss.ts).
import { feedNoticias } from "../lib/rss";

export const GET = () => feedNoticias("pt");

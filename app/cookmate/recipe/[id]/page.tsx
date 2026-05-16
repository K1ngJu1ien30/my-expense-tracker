import { LOCAL_RECIPES } from "@/lib/cookmate/localRecipes";
import RecipeDetail from "./RecipeDetail";

export function generateStaticParams() {
  return LOCAL_RECIPES.map(r => ({ id: r.id }));
}

export default function RecipePage() {
  return <RecipeDetail />;
}

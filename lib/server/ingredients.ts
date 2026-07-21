import { ingredientDatabaseColumns } from "./database";
import { numberValue, statusValue, text } from "./api";

export const ingredientColumns = ["id", "name", "scientific_name", "category_id", "origin", "status", "notes", ...ingredientDatabaseColumns];

const excelKeys = [
  "ABC3 (mEq/kg)", "ABC4 (mEq/kg)", "Dry Matter (%)", "Moisture (%)", "Crude Protein (%)", "Crude Fat (%)",
  "Crude Fiber (%)", "Ash (%)", "Calcium (%)", "Total Phosphorus (%)", "Available Phosphorus (%)", "Sodium (%)",
  "Potassium (%)", "Chloride (%)", "Magnesium (%)", "ME Poultry (kcal/kg)", "ME Swine (kcal/kg)", "DE (kcal/kg)",
  "Lysine (%)", "Methionine (%)", "Methionine+Cysteine (%)", "Threonine (%)", "Tryptophan (%)", "Valine (%)",
];

export function ingredientValues(body: Record<string, unknown>, id: string) {
  return [
    id,
    text(body["Ingredient Name"]),
    text(body["Scientific Name"]),
    text(body["Category ID"]),
    text(body.Origin, "Local"),
    statusValue(body.Status),
    text(body.Notes),
    ...excelKeys.map((key) => numberValue(body[key])),
  ];
}

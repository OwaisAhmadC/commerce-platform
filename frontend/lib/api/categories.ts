import { apiRequest } from "./client";

export type Category = {
  id: string;
  name: string;
};

export function listCategories() {
  return apiRequest<Category[]>("/categories");
}

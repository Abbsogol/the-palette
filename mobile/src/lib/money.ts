export const money = (value: number, currency = "AED") =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(
    Number(value),
  );

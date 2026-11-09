export function reportCommerceFailure(code) {
  console.warn(JSON.stringify({ event: "dmocks_commerce_failure", code }));
}

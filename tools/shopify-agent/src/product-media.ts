import { adminGraphql } from "./graphql.js";

const PRODUCT_BY_HANDLE = `
query productByHandle($handle: String!) {
  productByHandle(handle: $handle) {
    id
    title
    handle
  }
}`;

const PRODUCTS_RECENT = `
query productsRecent($first: Int!) {
  products(first: $first, sortKey: UPDATED_AT, reverse: true) {
    edges {
      node {
        id
        title
        handle
      }
    }
  }
}`;

const PRODUCTS_SEARCH = `
query productsSearch($first: Int!, $query: String!) {
  products(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
    edges {
      node {
        id
        title
        handle
      }
    }
  }
}`;

const PRODUCT_CREATE_MEDIA = `
mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media { id alt mediaContentType status }
    mediaUserErrors { field message code }
    userErrors { field message }
  }
}`;

export type ProductSummary = { id: string; title: string; handle: string };

/**
 * Search products for the UI. Pass empty query for latest updated products.
 */
export async function searchProducts(
  query: string,
  first = 30
): Promise<ProductSummary[]> {
  const q = query.trim();
  const data = q
    ? await adminGraphql<{
        products: { edges: { node: ProductSummary }[] };
      }>(PRODUCTS_SEARCH, { first, query: q })
    : await adminGraphql<{
        products: { edges: { node: ProductSummary }[] };
      }>(PRODUCTS_RECENT, { first });
  return (data.products?.edges ?? []).map((e) => e.node);
}

export async function getProductIdByHandle(handle: string): Promise<{ id: string; title: string }> {
  const data = await adminGraphql<{
    productByHandle: { id: string; title: string; handle: string } | null;
  }>(PRODUCT_BY_HANDLE, { handle });
  const p = data.productByHandle;
  if (!p) {
    throw new Error(`No product found with handle: ${handle}`);
  }
  return { id: p.id, title: p.title };
}

export type MediaItem = {
  resourceUrl: string;
  alt?: string;
  filename: string;
};

export async function appendProductMedia(productId: string, items: MediaItem[]): Promise<void> {
  if (items.length === 0) return;
  const media = items.map((item) => ({
    originalSource: item.resourceUrl,
    mediaContentType: "IMAGE",
    alt: item.alt ?? item.filename,
  }));
  const data = await adminGraphql<{
    productCreateMedia: {
      media: { id: string; status: string }[] | null;
      mediaUserErrors: { field: string[] | null; message: string; code?: string }[];
      userErrors: { field: string[] | null; message: string }[];
    };
  }>(PRODUCT_CREATE_MEDIA, { productId, media });
  const payload = data.productCreateMedia;
  const errs = [...(payload.mediaUserErrors ?? []), ...(payload.userErrors ?? [])];
  if (errs.length) {
    throw new Error(`productCreateMedia: ${errs.map((e) => e.message).join("; ")}`);
  }
}

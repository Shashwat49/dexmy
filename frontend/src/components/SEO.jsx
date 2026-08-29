import { useEffect } from "react";

const SITE_URL = "https://dexmyedu.com";
const DEFAULT_TITLE = "Dexmy | 1-on-1 Live Online Tutoring for SAT, AP, IB, IGCSE & More";
const DEFAULT_DESCRIPTION = "Dexmy provides 1-on-1 live online tutoring for SAT, PSAT, AP, TMUA, CBSE, ICSE, IGCSE, IB MYP and GCSE students with dedicated teachers and personalized learning.";

function upsertMeta(attribute, key, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertLink(rel, href) {
  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function upsertJsonLd(id, data) {
  let script = document.getElementById(id);
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export default function SEO({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION, path = "/" }) {
  useEffect(() => {
    const canonicalUrl = `${SITE_URL}${path === "/" ? "/" : path}`;

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    upsertMeta("name", "theme-color", "#0B0B0C");

    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "Dexmy");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", `${SITE_URL}/dexmy-logo-bg-removed.png`);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", `${SITE_URL}/dexmy-logo-bg-removed.png`);

    upsertLink("canonical", canonicalUrl);

    upsertJsonLd("dexmy-organization-schema", {
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      name: "Dexmy",
      url: SITE_URL,
      logo: `${SITE_URL}/dexmy-logo-bg-removed.png`,
      description: DEFAULT_DESCRIPTION,
      sameAs: ["https://www.linkedin.com/company/dexmyedu/"],
    });

    upsertJsonLd("dexmy-page-schema", {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: canonicalUrl,
      isPartOf: { "@type": "WebSite", name: "Dexmy", url: SITE_URL },
      publisher: { "@type": "EducationalOrganization", name: "Dexmy", url: SITE_URL },
    });
  }, [title, description, path]);

  return null;
}

/**
 * Public renderer for websites (store_type='website').
 *
 * Hosts:
 *  - On platform.printonet.com (and previews): mounted under /w/:storeSlug/*
 *  - On sites.printonet.com: mounted at root with first segment = :storeSlug
 *
 * Reads are RLS-public for published pages/posts on active website stores.
 */
import { useEffect, useMemo } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BlockPreview } from "@/components/cms/BlockPreview";
import { Loader2 } from "lucide-react";

type Site = {
  id: string;
  name: string;
  tenant_slug: string | null;
  store_type: string;
  status: string;
  primary_color: string;
  accent_color: string;
  font_family: string;
  logo_url: string | null;
  favicon_url: string | null;
};

type Page = {
  id: string;
  slug: string;
  title: string;
  sort_order: number;
  enabled: boolean;
  published_data: any | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
};

type NavItem = { label: string; href: string; open_in_new_tab?: boolean };

type Nav = {
  location: "header" | "footer";
  items: NavItem[];
};

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  hero_image_url: string | null;
  status: string;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  author_id: string | null;
};

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useSite(storeSlug: string | undefined) {
  return useQuery({
    queryKey: ["public-site", storeSlug],
    enabled: !!storeSlug,
    queryFn: async (): Promise<Site | null> => {
      if (!storeSlug) return null;
      const { data, error } = await supabase
        .from("corporate_stores")
        .select(
          "id, name, tenant_slug, store_type, status, primary_color, accent_color, font_family, logo_url, favicon_url",
        )
        .eq("tenant_slug", storeSlug)
        .eq("store_type", "website")
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return (data as Site | null) ?? null;
    },
  });
}

function usePages(storeId: string | undefined) {
  return useQuery({
    queryKey: ["public-site-pages", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<Page[]> => {
      const { data, error } = await (supabase as any)
        .from("site_pages")
        .select(
          "id, slug, title, sort_order, enabled, published_data, published_at, seo_title, seo_description, og_image_url",
        )
        .eq("store_id", storeId)
        .eq("enabled", true)
        .not("published_at", "is", null)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Page[];
    },
  });
}

function useNavigation(storeId: string | undefined) {
  return useQuery({
    queryKey: ["public-site-nav", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<Record<string, NavItem[]>> => {
      const { data, error } = await (supabase as any)
        .from("site_navigation")
        .select("location, items")
        .eq("store_id", storeId);
      if (error) throw error;
      const out: Record<string, NavItem[]> = { header: [], footer: [] };
      for (const row of (data ?? []) as Nav[]) {
        out[row.location] = Array.isArray(row.items) ? row.items : [];
      }
      return out;
    },
  });
}

function usePosts(storeId: string | undefined) {
  return useQuery({
    queryKey: ["public-site-posts", storeId],
    enabled: !!storeId,
    queryFn: async (): Promise<Post[]> => {
      const { data, error } = await (supabase as any)
        .from("blog_posts")
        .select(
          "id, slug, title, excerpt, body_md, hero_image_url, status, published_at, seo_title, seo_description, og_image_url, author_id",
        )
        .eq("store_id", storeId)
        .eq("status", "published")
        .not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
  });
}

// ---------------------------------------------------------------------------
// Path helpers — same components serve /w/:slug/... and sites.printonet.com/:slug/...
// ---------------------------------------------------------------------------

function isSitesHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.toLowerCase() === "sites.printonet.com";
}

function siteBase(storeSlug: string): string {
  return isSitesHost() ? `/${storeSlug}` : `/w/${storeSlug}`;
}

// ---------------------------------------------------------------------------
// Shell + theming
// ---------------------------------------------------------------------------

function applySiteTheme(site: Site | null | undefined) {
  useEffect(() => {
    if (!site) return;
    const prevTitle = document.title;
    document.title = site.name;
    if (site.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = site.favicon_url;
    }
    return () => {
      document.title = prevTitle;
    };
  }, [site?.id, site?.name, site?.favicon_url]);
}

function SiteShell({
  site,
  pages,
  navigation,
  children,
  seoTitle,
  seoDescription,
}: {
  site: Site;
  pages: Page[];
  navigation: Record<string, NavItem[]>;
  children: React.ReactNode;
  seoTitle?: string | null;
  seoDescription?: string | null;
}) {
  const base = siteBase(site.tenant_slug ?? "");

  useEffect(() => {
    if (seoTitle) document.title = `${seoTitle} · ${site.name}`;
  }, [seoTitle, site.name]);

  useEffect(() => {
    if (!seoDescription) return;
    let meta = document.querySelector<HTMLMetaElement>("meta[name='description']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = seoDescription;
  }, [seoDescription]);

  const headerItems: NavItem[] = navigation.header?.length
    ? navigation.header
    : pages.map((p) => ({ label: p.title, href: `${base}/${p.slug}` }));

  const footerItems = navigation.footer ?? [];

  const themeStyle = useMemo(
    () =>
      ({
        // Site-scoped CSS variables for theming buttons/links.
        ["--site-primary" as any]: site.primary_color,
        ["--site-accent" as any]: site.accent_color,
        fontFamily: site.font_family,
      }) as React.CSSProperties,
    [site.primary_color, site.accent_color, site.font_family],
  );

  return (
    <div style={themeStyle} className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to={base} className="flex items-center gap-3">
            {site.logo_url ? (
              <img src={site.logo_url} alt={site.name} className="h-8 w-auto" />
            ) : (
              <span className="text-lg font-semibold">{site.name}</span>
            )}
          </Link>
          <nav className="hidden gap-6 md:flex">
            {headerItems.map((item, i) => (
              <a
                key={`${item.href}-${i}`}
                href={item.href}
                target={item.open_in_new_tab ? "_blank" : undefined}
                rel={item.open_in_new_tab ? "noreferrer" : undefined}
                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-10 grid gap-6 md:grid-cols-2">
          <div>
            <div className="text-base font-semibold">{site.name}</div>
            <div className="mt-2 text-sm text-muted-foreground">
              © {new Date().getFullYear()} {site.name}. All rights reserved.
            </div>
          </div>
          {footerItems.length > 0 && (
            <nav className="flex flex-wrap gap-4 md:justify-end">
              {footerItems.map((item, i) => (
                <a
                  key={`${item.href}-${i}`}
                  href={item.href}
                  target={item.open_in_new_tab ? "_blank" : undefined}
                  rel={item.open_in_new_tab ? "noreferrer" : undefined}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loaders / not-found
// ---------------------------------------------------------------------------

function CenteredLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function NotFoundShell({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-semibold mb-2">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block renderer — reuses BlockPreview for v1 fidelity
// ---------------------------------------------------------------------------

function RenderBlocks({ blocks }: { blocks: any[] }) {
  if (!blocks?.length) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center text-muted-foreground">
        This page has no published content yet.
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-10">
      {blocks
        .filter((b) => b?.enabled !== false)
        .map((block, i) => (
          <section key={block.id ?? i}>
            <BlockPreview type={block.block_type ?? block.type} data={block.data ?? block.published_data ?? block.draft_data ?? {}} />
          </section>
        ))}
    </div>
  );
}

function extractBlocks(pageData: any): any[] {
  if (!pageData) return [];
  if (Array.isArray(pageData)) return pageData;
  if (Array.isArray(pageData.blocks)) return pageData.blocks;
  return [];
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/**
 * Home page — renders the page with slug 'home' (or first published page).
 */
export function PublicWebsiteHome() {
  const params = useParams();
  const storeSlug = params.storeSlug;
  const site = useSite(storeSlug);
  const pagesQ = usePages(site.data?.id);
  const navQ = useNavigation(site.data?.id);
  applySiteTheme(site.data);

  if (site.isLoading || pagesQ.isLoading || navQ.isLoading) return <CenteredLoader />;
  if (!site.data) {
    return (
      <NotFoundShell
        title="Site not found"
        message="This website doesn't exist or isn't published yet."
      />
    );
  }

  const pages = pagesQ.data ?? [];
  const home = pages.find((p) => p.slug === "home") ?? pages[0];
  const blocks = home ? extractBlocks(home.published_data) : [];

  return (
    <SiteShell
      site={site.data}
      pages={pages}
      navigation={navQ.data ?? {}}
      seoTitle={home?.seo_title}
      seoDescription={home?.seo_description}
    >
      {home ? (
        <RenderBlocks blocks={blocks} />
      ) : (
        <div className="mx-auto max-w-3xl px-6 py-24 text-center text-muted-foreground">
          No pages published yet.
        </div>
      )}
    </SiteShell>
  );
}

/**
 * Generic content page by slug.
 */
export function PublicWebsitePage() {
  const params = useParams();
  const storeSlug = params.storeSlug;
  const pageSlug = params.pageSlug;
  const site = useSite(storeSlug);
  const pagesQ = usePages(site.data?.id);
  const navQ = useNavigation(site.data?.id);
  applySiteTheme(site.data);

  if (site.isLoading || pagesQ.isLoading || navQ.isLoading) return <CenteredLoader />;
  if (!site.data) {
    return (
      <NotFoundShell title="Site not found" message="This website isn't available." />
    );
  }

  const pages = pagesQ.data ?? [];
  const page = pages.find((p) => p.slug === pageSlug);

  if (!page) {
    return (
      <SiteShell site={site.data} pages={pages} navigation={navQ.data ?? {}}>
        <NotFoundShell title="Page not found" message="That page doesn't exist." />
      </SiteShell>
    );
  }

  return (
    <SiteShell
      site={site.data}
      pages={pages}
      navigation={navQ.data ?? {}}
      seoTitle={page.seo_title ?? page.title}
      seoDescription={page.seo_description}
    >
      <RenderBlocks blocks={extractBlocks(page.published_data)} />
    </SiteShell>
  );
}

/**
 * Blog index — lists published posts.
 */
export function PublicWebsiteBlogIndex() {
  const params = useParams();
  const storeSlug = params.storeSlug;
  const site = useSite(storeSlug);
  const pagesQ = usePages(site.data?.id);
  const navQ = useNavigation(site.data?.id);
  const postsQ = usePosts(site.data?.id);
  applySiteTheme(site.data);

  if (site.isLoading || postsQ.isLoading) return <CenteredLoader />;
  if (!site.data) {
    return <NotFoundShell title="Site not found" message="This website isn't available." />;
  }

  const posts = postsQ.data ?? [];
  const base = siteBase(site.data.tenant_slug ?? "");

  return (
    <SiteShell
      site={site.data}
      pages={pagesQ.data ?? []}
      navigation={navQ.data ?? {}}
      seoTitle="Blog"
    >
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight mb-8">Blog</h1>
        {posts.length === 0 ? (
          <p className="text-muted-foreground">No posts published yet.</p>
        ) : (
          <div className="grid gap-8">
            {posts.map((post) => (
              <article key={post.id} className="group">
                <Link to={`${base}/blog/${post.slug}`} className="block">
                  {post.hero_image_url && (
                    <img
                      src={post.hero_image_url}
                      alt={post.title}
                      className="mb-4 aspect-[16/9] w-full rounded-lg object-cover"
                    />
                  )}
                  <h2 className="text-2xl font-semibold group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>
                  {post.published_at && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {new Date(post.published_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                  )}
                  {post.excerpt && (
                    <p className="mt-3 text-muted-foreground leading-relaxed">{post.excerpt}</p>
                  )}
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}

/**
 * Single blog post.
 */
export function PublicWebsiteBlogPost() {
  const params = useParams();
  const storeSlug = params.storeSlug;
  const postSlug = params.postSlug;
  const site = useSite(storeSlug);
  const pagesQ = usePages(site.data?.id);
  const navQ = useNavigation(site.data?.id);
  const postsQ = usePosts(site.data?.id);
  applySiteTheme(site.data);

  if (site.isLoading || postsQ.isLoading) return <CenteredLoader />;
  if (!site.data) {
    return <NotFoundShell title="Site not found" message="This website isn't available." />;
  }

  const post = (postsQ.data ?? []).find((p) => p.slug === postSlug);

  if (!post) {
    return (
      <SiteShell site={site.data} pages={pagesQ.data ?? []} navigation={navQ.data ?? {}}>
        <NotFoundShell title="Post not found" message="That post doesn't exist." />
      </SiteShell>
    );
  }

  return (
    <SiteShell
      site={site.data}
      pages={pagesQ.data ?? []}
      navigation={navQ.data ?? {}}
      seoTitle={post.seo_title ?? post.title}
      seoDescription={post.seo_description ?? post.excerpt}
    >
      <article className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
          {post.published_at && (
            <div className="mt-2 text-sm text-muted-foreground">
              {new Date(post.published_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          )}
        </header>
        {post.hero_image_url && (
          <img
            src={post.hero_image_url}
            alt={post.title}
            className="mb-8 aspect-[16/9] w-full rounded-lg object-cover"
          />
        )}
        {/* Minimal markdown rendering — preserves line breaks and paragraphs */}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          {post.body_md
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((para, i) => (
              <p key={i} className="whitespace-pre-wrap leading-relaxed mb-4">
                {para}
              </p>
            ))}
        </div>
      </article>
    </SiteShell>
  );
}

/**
 * Optional default export (unused, but handy for lazy imports).
 */
export default PublicWebsiteHome;

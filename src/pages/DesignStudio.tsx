import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricText, Rect, Circle, Triangle, Polygon, Line as FabricLine, Ellipse, FabricImage, Group, Path, Pattern, Point } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, ArrowLeft, Type, Square, CircleIcon, TriangleIcon,
  Upload, Undo2, Redo2, Trash2, Eye, EyeOff, Lock, Unlock,
  ChevronUp, ChevronDown, Layers as LayersIcon, Palette, Save,
  Copy,
  ShoppingCart, ImageIcon, Sticker,
  Heart, Star, Flame, Zap, Music, Sun, Moon, Cloud,
  Coffee, Camera, Anchor, Award, Bell, Bookmark, Crown,
  Diamond, Flag, Gift, Globe, Key, Leaf, Mountain,
  Rocket, Shield, Smile, Snowflake, Target, Umbrella, Wifi,
  Hexagon, Pentagon, Minus, ArrowRight, RectangleHorizontal,
  Cat, Dog, Fish, Bird, Bug, Flower2, TreePine, Waves,
  Bike, Car, Plane, Train, Ship,
  Gamepad2, Trophy, Dumbbell, Timer, Headphones,
  Pizza, Apple, IceCreamCone, Cake, Wine,
  Laptop, Smartphone, Monitor, Printer, Watch,
  Paintbrush, Pen, Scissors, Ruler, Eraser,
  Home, Building2, Church, Landmark, Store,
  Baby, Users, UserCircle, GraduationCap, Briefcase,
  ThumbsUp, ThumbsDown, PartyPopper, Laugh, Angry,
  Lightbulb, Atom, Microscope, Telescope, Dna,
  Swords, Bomb, Skull, Ghost, Wand2,
} from "lucide-react";
import ReactDOMServer from "react-dom/server";
import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GOOGLE_FONTS = [
  "Inter", "Space Grotesk", "Roboto", "Open Sans", "Lato", "Montserrat",
  "Poppins", "Oswald", "Raleway", "Playfair Display", "Merriweather",
  "Bebas Neue", "Lobster", "Pacifico", "Dancing Script", "Permanent Marker",
  "Bangers", "Righteous", "Abril Fatface", "Alfa Slab One", "Anton",
  "Archivo Black", "Bungee", "Caveat", "Comfortaa", "Concert One",
  "Fredoka One", "Gloria Hallelujah", "Indie Flower", "Josefin Sans",
  "Kalam", "Lilita One", "Luckiest Guy", "Nunito", "Passion One",
  "Patrick Hand", "Press Start 2P", "Rubik", "Sacramento", "Satisfy",
  "Shadows Into Light", "Source Sans 3", "Titan One", "Ubuntu",
  "Vollkorn", "Yanone Kaffeesatz", "Zilla Slab",
];

const loadedFonts = new Set<string>(["Inter", "Space Grotesk"]);

function loadGoogleFont(fontFamily: string) {
  if (loadedFonts.has(fontFamily)) return;
  loadedFonts.add(fontFamily);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}&display=swap`;
  document.head.appendChild(link);
}

const CLIPART_CATEGORIES: Record<string, { name: string; icon: React.ComponentType<any> }[]> = {
  "Popular": [
    { name: "Heart", icon: Heart },
    { name: "Star", icon: Star },
    { name: "Smile", icon: Smile },
    { name: "Crown", icon: Crown },
    { name: "Diamond", icon: Diamond },
    { name: "Flame", icon: Flame },
    { name: "Zap", icon: Zap },
    { name: "Rocket", icon: Rocket },
    { name: "Thumbs Up", icon: ThumbsUp },
    { name: "Party", icon: PartyPopper },
    { name: "Lightbulb", icon: Lightbulb },
    { name: "Trophy", icon: Trophy },
  ],
  "Animals": [
    { name: "Cat", icon: Cat },
    { name: "Dog", icon: Dog },
    { name: "Fish", icon: Fish },
    { name: "Bird", icon: Bird },
    { name: "Bug", icon: Bug },
  ],
  "Nature": [
    { name: "Sun", icon: Sun },
    { name: "Moon", icon: Moon },
    { name: "Cloud", icon: Cloud },
    { name: "Leaf", icon: Leaf },
    { name: "Mountain", icon: Mountain },
    { name: "Snowflake", icon: Snowflake },
    { name: "Umbrella", icon: Umbrella },
    { name: "Flower", icon: Flower2 },
    { name: "Tree", icon: TreePine },
    { name: "Waves", icon: Waves },
  ],
  "Food": [
    { name: "Pizza", icon: Pizza },
    { name: "Apple", icon: Apple },
    { name: "Ice Cream", icon: IceCreamCone },
    { name: "Cake", icon: Cake },
    { name: "Wine", icon: Wine },
    { name: "Coffee", icon: Coffee },
  ],
  "Travel": [
    { name: "Bike", icon: Bike },
    { name: "Car", icon: Car },
    { name: "Plane", icon: Plane },
    { name: "Train", icon: Train },
    { name: "Ship", icon: Ship },
    { name: "Globe", icon: Globe },
    { name: "Anchor", icon: Anchor },
  ],
  "Tech": [
    { name: "Laptop", icon: Laptop },
    { name: "Phone", icon: Smartphone },
    { name: "Monitor", icon: Monitor },
    { name: "Watch", icon: Watch },
    { name: "Headphones", icon: Headphones },
    { name: "Gamepad", icon: Gamepad2 },
    { name: "Camera", icon: Camera },
  ],
  "Sports": [
    { name: "Trophy", icon: Trophy },
    { name: "Dumbbell", icon: Dumbbell },
    { name: "Timer", icon: Timer },
    { name: "Target", icon: Target },
    { name: "Shield", icon: Shield },
  ],
  "Tools": [
    { name: "Paintbrush", icon: Paintbrush },
    { name: "Pen", icon: Pen },
    { name: "Scissors", icon: Scissors },
    { name: "Ruler", icon: Ruler },
    { name: "Eraser", icon: Eraser },
    { name: "Wand", icon: Wand2 },
  ],
  "People": [
    { name: "Baby", icon: Baby },
    { name: "Users", icon: Users },
    { name: "Person", icon: UserCircle },
    { name: "Graduate", icon: GraduationCap },
    { name: "Business", icon: Briefcase },
  ],
  "Buildings": [
    { name: "Home", icon: Home },
    { name: "Building", icon: Building2 },
    { name: "Church", icon: Church },
    { name: "Landmark", icon: Landmark },
    { name: "Store", icon: Store },
  ],
  "Emojis": [
    { name: "Smile", icon: Smile },
    { name: "Laugh", icon: Laugh },
    { name: "Angry", icon: Angry },
    { name: "Thumbs Up", icon: ThumbsUp },
    { name: "Thumbs Down", icon: ThumbsDown },
    { name: "Ghost", icon: Ghost },
    { name: "Skull", icon: Skull },
  ],
  "Science": [
    { name: "Atom", icon: Atom },
    { name: "Microscope", icon: Microscope },
    { name: "Telescope", icon: Telescope },
    { name: "DNA", icon: Dna },
    { name: "Lightbulb", icon: Lightbulb },
  ],
  "Objects": [
    { name: "Award", icon: Award },
    { name: "Bell", icon: Bell },
    { name: "Bookmark", icon: Bookmark },
    { name: "Flag", icon: Flag },
    { name: "Gift", icon: Gift },
    { name: "Key", icon: Key },
    { name: "Music", icon: Music },
    { name: "Wifi", icon: Wifi },
    { name: "Bomb", icon: Bomb },
    { name: "Swords", icon: Swords },
  ],
};

interface TextTemplateLine {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  fontStyle?: string;
  textTransform?: string;
  letterSpacing?: string;
}

interface TextTemplate {
  name: string;
  lines: TextTemplateLine[];
}

const TEXT_TEMPLATES: TextTemplate[] = [
  {
    name: "Bold Statement",
    lines: [
      { text: "MAKE IT", fontFamily: "Arial Black, sans-serif", fontSize: 48, fontWeight: "900", textTransform: "uppercase", letterSpacing: "2px" },
      { text: "HAPPEN", fontFamily: "Arial Black, sans-serif", fontSize: 64, fontWeight: "900", textTransform: "uppercase", letterSpacing: "4px" },
    ],
  },
  {
    name: "Vintage Label",
    lines: [
      { text: "— ESTABLISHED —", fontFamily: "Georgia, serif", fontSize: 18, letterSpacing: "4px", textTransform: "uppercase" },
      { text: "Premium Quality", fontFamily: "Georgia, serif", fontSize: 42, fontStyle: "italic" },
      { text: "SINCE 2024", fontFamily: "Georgia, serif", fontSize: 20, letterSpacing: "6px", textTransform: "uppercase" },
    ],
  },
  {
    name: "Modern Minimal",
    lines: [
      { text: "less is", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 28, fontWeight: "300" },
      { text: "more.", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 52, fontWeight: "700" },
    ],
  },
  {
    name: "Street Style",
    lines: [
      { text: "NO LIMITS", fontFamily: "Impact, sans-serif", fontSize: 56, textTransform: "uppercase", letterSpacing: "3px" },
      { text: "BREAK THE RULES", fontFamily: "Impact, sans-serif", fontSize: 24, textTransform: "uppercase", letterSpacing: "8px" },
    ],
  },
  {
    name: "Elegant Script",
    lines: [
      { text: "forever", fontFamily: "Georgia, serif", fontSize: 20, fontStyle: "italic", letterSpacing: "6px", textTransform: "lowercase" },
      { text: "Grateful", fontFamily: "Georgia, serif", fontSize: 52, fontStyle: "italic" },
    ],
  },
  {
    name: "Retro Badge",
    lines: [
      { text: "★ ORIGINAL ★", fontFamily: "Courier New, monospace", fontSize: 18, textTransform: "uppercase", letterSpacing: "3px" },
      { text: "AUTHENTIC", fontFamily: "Courier New, monospace", fontSize: 44, fontWeight: "700", textTransform: "uppercase" },
      { text: "GOODS & SUPPLY CO.", fontFamily: "Courier New, monospace", fontSize: 16, letterSpacing: "4px", textTransform: "uppercase" },
    ],
  },
  {
    name: "Motivational",
    lines: [
      { text: "STAY", fontFamily: "Arial, sans-serif", fontSize: 32, fontWeight: "300", letterSpacing: "10px", textTransform: "uppercase" },
      { text: "HUNGRY", fontFamily: "Arial Black, sans-serif", fontSize: 58, fontWeight: "900", textTransform: "uppercase" },
      { text: "stay foolish", fontFamily: "Georgia, serif", fontSize: 22, fontStyle: "italic" },
    ],
  },
  {
    name: "Clean & Simple",
    lines: [
      { text: "good vibes", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 36, fontWeight: "300" },
      { text: "ONLY", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 48, fontWeight: "800", letterSpacing: "8px", textTransform: "uppercase" },
    ],
  },
  {
    name: "Arch Type",
    lines: [
      { text: "THE", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 16, fontWeight: "400", letterSpacing: "8px", textTransform: "uppercase" },
      { text: "ADVENTURE", fontFamily: "Arial Black, sans-serif", fontSize: 44, fontWeight: "900", textTransform: "uppercase", letterSpacing: "2px" },
      { text: "AWAITS", fontFamily: "Arial Black, sans-serif", fontSize: 44, fontWeight: "900", textTransform: "uppercase", letterSpacing: "2px" },
    ],
  },
  {
    name: "Stacked Serif",
    lines: [
      { text: "Dream", fontFamily: "Georgia, serif", fontSize: 52, fontWeight: "700" },
      { text: "WITHOUT", fontFamily: "Georgia, serif", fontSize: 20, letterSpacing: "10px", textTransform: "uppercase" },
      { text: "LIMITS", fontFamily: "Georgia, serif", fontSize: 20, letterSpacing: "10px", textTransform: "uppercase" },
    ],
  },
  {
    name: "Varsity",
    lines: [
      { text: "TEAM", fontFamily: "Impact, sans-serif", fontSize: 22, textTransform: "uppercase", letterSpacing: "12px" },
      { text: "PLAYERS", fontFamily: "Impact, sans-serif", fontSize: 56, textTransform: "uppercase" },
      { text: "— EST. 2024 —", fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", letterSpacing: "3px" },
    ],
  },
  {
    name: "Handwritten",
    lines: [
      { text: "enjoy the", fontFamily: "Georgia, serif", fontSize: 24, fontStyle: "italic" },
      { text: "little things", fontFamily: "Georgia, serif", fontSize: 42, fontStyle: "italic" },
    ],
  },
  {
    name: "Block Quote",
    lines: [
      { text: "BE THE", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 36, fontWeight: "800", textTransform: "uppercase" },
      { text: "CHANGE", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 52, fontWeight: "800", textTransform: "uppercase" },
      { text: "— Gandhi", fontFamily: "Georgia, serif", fontSize: 18, fontStyle: "italic" },
    ],
  },
  {
    name: "Neon Vibe",
    lines: [
      { text: "GOOD", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 60, fontWeight: "100" },
      { text: "TIMES", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 60, fontWeight: "100" },
    ],
  },
  {
    name: "Label Stamp",
    lines: [
      { text: "[ HANDCRAFTED ]", fontFamily: "Courier New, monospace", fontSize: 14, textTransform: "uppercase", letterSpacing: "4px" },
      { text: "WITH LOVE", fontFamily: "Courier New, monospace", fontSize: 38, fontWeight: "700", textTransform: "uppercase" },
      { text: "& PASSION", fontFamily: "Courier New, monospace", fontSize: 38, fontWeight: "700", textTransform: "uppercase" },
      { text: "— SMALL BATCH —", fontFamily: "Courier New, monospace", fontSize: 14, textTransform: "uppercase", letterSpacing: "4px" },
    ],
  },
  {
    name: "Wave Text",
    lines: [
      { text: "ride", fontFamily: "Georgia, serif", fontSize: 28, fontStyle: "italic" },
      { text: "THE WAVE", fontFamily: "Arial Black, sans-serif", fontSize: 52, fontWeight: "900", textTransform: "uppercase" },
    ],
  },
  {
    name: "Mono Stack",
    lines: [
      { text: "CODE.", fontFamily: "Courier New, monospace", fontSize: 36, fontWeight: "700" },
      { text: "CREATE.", fontFamily: "Courier New, monospace", fontSize: 36, fontWeight: "700" },
      { text: "REPEAT.", fontFamily: "Courier New, monospace", fontSize: 36, fontWeight: "700" },
    ],
  },
  {
    name: "Editorial",
    lines: [
      { text: "Vol. 01", fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", letterSpacing: "3px" },
      { text: "THE DAILY", fontFamily: "Georgia, serif", fontSize: 48, fontWeight: "700", textTransform: "uppercase", letterSpacing: "2px" },
      { text: "HUSTLE", fontFamily: "Georgia, serif", fontSize: 48, fontWeight: "700", textTransform: "uppercase", letterSpacing: "2px" },
    ],
  },
  {
    name: "Sporty Bold",
    lines: [
      { text: "JUST", fontFamily: "Impact, sans-serif", fontSize: 28, textTransform: "uppercase", letterSpacing: "6px" },
      { text: "GO FOR IT", fontFamily: "Impact, sans-serif", fontSize: 52, textTransform: "uppercase" },
    ],
  },
  {
    name: "Coffee Shop",
    lines: [
      { text: "freshly", fontFamily: "Georgia, serif", fontSize: 22, fontStyle: "italic" },
      { text: "BREWED", fontFamily: "Arial Black, sans-serif", fontSize: 48, fontWeight: "900", textTransform: "uppercase", letterSpacing: "4px" },
      { text: "est. MMXXIV", fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", letterSpacing: "3px" },
    ],
  },
];

type ViewSide = "front" | "back" | "side1" | "side2";

interface ProductVariant {
  color: string;
  colorName: string;
  hex: string;
}

interface InventoryProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number;
  image_front: string | null;
  image_back: string | null;
  image_side1: string | null;
  image_side2: string | null;
  print_areas?: Record<string, { x: number; y: number; width: number; height: number }> | null;
}

interface EmbedProductData {
  name: string;
  category?: string;
  description?: string;
  image_front?: string;
  image_back?: string;
  image_side1?: string;
  image_side2?: string;
  variants?: Array<{ color: string; colorName: string; hex: string }>;
  print_areas?: Record<string, { x: number; y: number; width: number; height: number }>;
}

import { type BrandConfig, DEFAULT_BRAND_CONFIG, applyBrandCSS } from "@/lib/brand-config";

interface DesignStudioProps {
  embedMode?: boolean;
  sessionId?: string;
  embedProductData?: EmbedProductData;
  brandConfig?: BrandConfig;
}

const VIEW_LABELS: Record<ViewSide, string> = {
  front: "Front",
  back: "Back",
  side1: "Left",
  side2: "Right",
};

export default function DesignStudio({ embedMode = false, sessionId, embedProductData, brandConfig }: DesignStudioProps) {
  const navigate = useNavigate();
  const [dbBrandConfig, setDbBrandConfig] = useState<BrandConfig | null>(null);
  const brand = brandConfig || dbBrandConfig || DEFAULT_BRAND_CONFIG;

  // Load brand config from database when no brandConfig prop provided
  useEffect(() => {
    if (brandConfig) return;
    async function loadBrandConfig() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("brand_configs")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setDbBrandConfig({
            name: data.name || "",
            logoUrl: data.logo_url || "",
            theme: (data.theme === "light" ? "light" : "dark") as "light" | "dark",
            primaryColor: data.primary_color,
            accentColor: data.accent_color,
            fontFamily: data.font_family,
            borderRadius: data.border_radius,
          });
        }
      } catch (err) {
        console.error("Failed to load brand config:", err);
      }
    }
    loadBrandConfig();
  }, [brandConfig]);

  // Apply brand CSS vars when brand config changes
  useEffect(() => {
    const isCustomBrand = brand.primaryColor !== DEFAULT_BRAND_CONFIG.primaryColor ||
      brand.accentColor !== DEFAULT_BRAND_CONFIG.accentColor ||
      brand.theme !== DEFAULT_BRAND_CONFIG.theme ||
      brand.fontFamily !== DEFAULT_BRAND_CONFIG.fontFamily ||
      brand.borderRadius !== DEFAULT_BRAND_CONFIG.borderRadius;

    if (isCustomBrand) {
      applyBrandCSS(document.documentElement, brand);
    }
    return () => {
      if (isCustomBrand) {
        applyBrandCSS(document.documentElement, DEFAULT_BRAND_CONFIG);
      }
    };
  }, [brand]);

  const [invProduct, setInvProduct] = useState<InventoryProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTool, setActiveTool] = useState<string>("text");
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeView, setActiveView] = useState<ViewSide>("front");
  const [availableViews, setAvailableViews] = useState<ViewSide[]>(["front"]);
  const [layers, setLayers] = useState<any[]>([]);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [objectProps, setObjectProps] = useState({ opacity: 100, fill: "#000000" });
  const [textInput, setTextInput] = useState("Your Text");
  const [fontSize, setFontSize] = useState(32);
  const [fillColor, setFillColor] = useState("#7c3aed");
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [clipartCategory, setClipartCategory] = useState<string>("Popular");
  const [fontFamily, setFontFamily] = useState<string>("Inter");
  const [showPrintAreaBoundary, setShowPrintAreaBoundary] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiHistory, setAiHistory] = useState<Array<{ prompt: string; imageUrl: string }>>([]);
  const [removingBg, setRemovingBg] = useState(false);
  const [aiStyle, setAiStyle] = useState<string>("");
  const viewStatesRef = useRef<Record<ViewSide, string | null>>({ front: null, back: null, side1: null, side2: null });
  const currentCanvasViewRef = useRef<ViewSide>("front");
  const isLoadingViewRef = useRef(false);
  const viewLoadRequestRef = useRef(0);
  const [imageBounds, setImageBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const imageBoundsRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const imageAspectRatioRef = useRef<number | null>(null);
  const invProductRef = useRef(invProduct);

  // Compute where the product image actually renders within the canvas (object-contain)
  function computeImageBounds(canvasW: number, canvasH: number, imgNatW: number, imgNatH: number) {
    const scale = Math.min(canvasW / imgNatW, canvasH / imgNatH);
    const w = imgNatW * scale;
    const h = imgNatH * scale;
    const x = (canvasW - w) / 2;
    const y = (canvasH - h) / 2;
    return { x, y, w, h };
  }

  function computeImageBoundsFromAspect(canvasW: number, canvasH: number, aspectRatio: number) {
    let w = canvasW;
    let h = w / aspectRatio;

    if (h > canvasH) {
      h = canvasH;
      w = h * aspectRatio;
    }

    return {
      x: (canvasW - w) / 2,
      y: (canvasH - h) / 2,
      w,
      h,
    };
  }

  function remapCanvasObjectsToImageBounds(
    canvas: FabricCanvas,
    fromBounds: { x: number; y: number; w: number; h: number },
    toBounds: { x: number; y: number; w: number; h: number }
  ) {
    if (fromBounds.w === 0 || fromBounds.h === 0) return;

    const scaleX = toBounds.w / fromBounds.w;
    const scaleY = toBounds.h / fromBounds.h;

    canvas.getObjects().forEach((obj: any) => {
      if ((obj as any).customName === PRINT_AREA_RECT_NAME) return;

      const center = obj.getCenterPoint();
      const relX = (center.x - fromBounds.x) / fromBounds.w;
      const relY = (center.y - fromBounds.y) / fromBounds.h;
      const nextCenterX = toBounds.x + relX * toBounds.w;
      const nextCenterY = toBounds.y + relY * toBounds.h;

      obj.set({
        scaleX: (obj.scaleX ?? 1) * scaleX,
        scaleY: (obj.scaleY ?? 1) * scaleY,
      });
      obj.setPositionByOrigin(new Point(nextCenterX, nextCenterY), "center", "center");
      obj.setCoords();
      rememberLastValidTransform(obj);
    });
  }

  // Load the current background image's natural dimensions and compute bounds
  useEffect(() => {
    const url = getCurrentImageUrl();
    if (!url || !fabricRef.current) {
      setImageBounds(null);
      imageBoundsRef.current = null;
      imageAspectRatioRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      imageAspectRatioRef.current = img.naturalWidth / img.naturalHeight;
      const bounds = computeImageBounds(canvas.getWidth(), canvas.getHeight(), img.naturalWidth, img.naturalHeight);
      setImageBounds(bounds);
      imageBoundsRef.current = bounds;
    };
    img.src = url;
  }, [activeView, invProduct, loading]);

  // Keep refs in sync
  useEffect(() => { invProductRef.current = invProduct; }, [invProduct]);
  useEffect(() => { imageBoundsRef.current = imageBounds; }, [imageBounds]);

  // Recalculate image bounds on canvas resize
  useEffect(() => {
    if (!containerRef.current || !imageBounds) return;
    const url = getCurrentImageUrl();
    if (!url) return;
    const observer = new ResizeObserver(() => {
      const img = new Image();
      img.onload = () => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const bounds = computeImageBounds(canvas.getWidth(), canvas.getHeight(), img.naturalWidth, img.naturalHeight);
        setImageBounds(bounds);
      };
      img.src = url;
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [activeView, invProduct]);

  // Convert print area percentages to canvas pixel coordinates using image bounds
  function printAreaToCanvasCoords(pa: { x: number; y: number; width: number; height: number }) {
    const canvas = fabricRef.current;
    if (!canvas) return { px: 0, py: 0, pw: 0, ph: 0 };
    // Use ref for fresh value in event handlers
    const bounds = imageBoundsRef.current;
    if (bounds) {
      // Map percentages relative to the actual image position within canvas
      return {
        px: bounds.x + (pa.x / 100) * bounds.w,
        py: bounds.y + (pa.y / 100) * bounds.h,
        pw: (pa.width / 100) * bounds.w,
        ph: (pa.height / 100) * bounds.h,
      };
    }
    // Fallback: no image bounds, use full canvas
    return {
      px: (pa.x / 100) * canvas.getWidth(),
      py: (pa.y / 100) * canvas.getHeight(),
      pw: (pa.width / 100) * canvas.getWidth(),
      ph: (pa.height / 100) * canvas.getHeight(),
    };
  }

  function serializeCanvasState() {
    if (!fabricRef.current) return null;
    // Temporarily remove print area boundary before serializing
    const canvas = fabricRef.current;
    const paRects = canvas.getObjects().filter((o: any) => (o as any).customName === PRINT_AREA_RECT_NAME);
    paRects.forEach((o) => canvas.remove(o));
    const json = JSON.stringify(canvas.toJSON());
    // Re-add them
    paRects.forEach((o) => { canvas.add(o); canvas.sendObjectToBack(o); });
    return json;
  }

  // Save current canvas state to the currently mounted view's slot
  function saveViewState(view: ViewSide = currentCanvasViewRef.current) {
    if (isLoadingViewRef.current) return;
    const json = serializeCanvasState();
    if (!json) return;
    viewStatesRef.current[view] = json;
  }
  
  // Set up embed product data
  useEffect(() => {
    if (!embedMode || !embedProductData) return;
    const ep: InventoryProduct = {
      id: sessionId || "embed",
      name: embedProductData.name,
      description: embedProductData.description || null,
      category: embedProductData.category || "apparel",
      base_price: 0,
      image_front: embedProductData.image_front || null,
      image_back: embedProductData.image_back || null,
      image_side1: embedProductData.image_side1 || null,
      image_side2: embedProductData.image_side2 || null,
      print_areas: embedProductData.print_areas || null,
    };
    setInvProduct(ep);
    const views: ViewSide[] = [];
    if (ep.image_front) views.push("front");
    if (ep.image_back) views.push("back");
    if (ep.image_side1) views.push("side1");
    if (ep.image_side2) views.push("side2");
    if (views.length === 0) views.push("front");
    setAvailableViews(views);
    currentCanvasViewRef.current = views[0];
    setActiveView(views[0]);
    setLoading(false);
  }, [embedMode, embedProductData]);

  // Get current background image URL
  function getCurrentImageUrl(): string | null {
    if (!invProduct) return null;
    const map: Record<ViewSide, string | null> = {
      front: invProduct.image_front,
      back: invProduct.image_back,
      side1: invProduct.image_side1,
      side2: invProduct.image_side2,
    };
    return map[activeView] || null;
  }

  // Get print area for current view (percentage-based)
  function getCurrentPrintArea(): { x: number; y: number; width: number; height: number } | null {
    if (!invProduct?.print_areas) return null;
    const viewKey = activeView === "side1" ? "side1" : activeView === "side2" ? "side2" : activeView;
    return invProduct.print_areas[viewKey] || null;
  }

  const PRINT_AREA_RECT_NAME = "__print_area_boundary__";

  // Add/update print area boundary rect on canvas
  function updatePrintAreaRect(canvas: FabricCanvas) {
    // Remove existing boundary
    const existing = canvas.getObjects().filter((o: any) => o.customName === PRINT_AREA_RECT_NAME);
    existing.forEach((o) => canvas.remove(o));

    const pa = getCurrentPrintArea();
    if (!pa || !showPrintAreaBoundary) return;

    const { px, py, pw, ph } = printAreaToCanvasCoords(pa);

    const boundary = new Rect({
      left: px,
      top: py,
      width: pw,
      height: ph,
      fill: "transparent",
      stroke: "#6366f1",
      strokeWidth: 2,
      strokeDashArray: [8, 4],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    (boundary as any).customName = PRINT_AREA_RECT_NAME;
    canvas.add(boundary);
    // Send to back so it's behind design objects
    canvas.sendObjectToBack(boundary);
    canvas.renderAll();
  }

  // Toggle print area boundary visibility / update when image bounds change
  useEffect(() => {
    if (!fabricRef.current) return;
    updatePrintAreaRect(fabricRef.current);
  }, [showPrintAreaBoundary, imageBounds]);

  // Hard containment: clamp movement to the print area and revert unsupported transforms that exit it
  function getCurrentPrintAreaCoords() {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    const product = invProductRef.current;
    if (!product?.print_areas) return null;
    const viewKey = currentCanvasViewRef.current === "side1" ? "side1" : currentCanvasViewRef.current === "side2" ? "side2" : currentCanvasViewRef.current;
    const pa = product.print_areas[viewKey];
    if (!pa) return null;
    return printAreaToCanvasCoords(pa);
  }

  function isObjectInsidePrintArea(obj: any) {
    const coords = getCurrentPrintAreaCoords();
    if (!coords) return true;
    const { px, py, pw, ph } = coords;
    const TOLERANCE = 2; // pixels of slack to prevent edge-locking
    const bound = obj.getBoundingRect();
    return (
      bound.left >= px - TOLERANCE &&
      bound.top >= py - TOLERANCE &&
      bound.left + bound.width <= px + pw + TOLERANCE &&
      bound.top + bound.height <= py + ph + TOLERANCE
    );
  }

  function rememberLastValidTransform(obj: any) {
    if (!obj || (obj as any).customName === PRINT_AREA_RECT_NAME) return;
    (obj as any).__lastValidTransform = {
      left: obj.left,
      top: obj.top,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      angle: obj.angle,
      skewX: obj.skewX,
      skewY: obj.skewY,
      flipX: obj.flipX,
      flipY: obj.flipY,
    };
  }

  function restoreLastValidTransform(obj: any) {
    const last = (obj as any)?.__lastValidTransform;
    if (!last) {
      centerObjectInPrintArea(obj);
      return;
    }
    obj.set(last);
    obj.setCoords();
  }

  function clampObjectPositionInsidePrintArea(obj: any) {
    const coords = getCurrentPrintAreaCoords();
    if (!coords || !obj) return false;

    const { px, py, pw, ph } = coords;
    const bound = obj.getBoundingRect();
    let dx = 0;
    let dy = 0;

    if (bound.left < px) {
      dx = px - bound.left;
    } else if (bound.left + bound.width > px + pw) {
      dx = px + pw - (bound.left + bound.width);
    }

    if (bound.top < py) {
      dy = py - bound.top;
    } else if (bound.top + bound.height > py + ph) {
      dy = py + ph - (bound.top + bound.height);
    }

    if (dx === 0 && dy === 0) return false;

    obj.set({
      left: (obj.left || 0) + dx,
      top: (obj.top || 0) + dy,
    });
    obj.setCoords();
    return true;
  }

  function centerObjectInPrintArea(obj: any) {
    const coords = getCurrentPrintAreaCoords();
    const canvas = fabricRef.current;
    if (!obj || !canvas) return;

    if (!coords) {
      obj.set({ left: canvas.getWidth() / 2, top: canvas.getHeight() / 2, originX: "center", originY: "center" });
      obj.setCoords();
      rememberLastValidTransform(obj);
      return;
    }

    const { px, py, pw, ph } = coords;
    obj.set({ left: px + pw / 2, top: py + ph / 2, originX: "center", originY: "center" });
    obj.setCoords();

    if (!isObjectInsidePrintArea(obj)) {
      const bound = obj.getBoundingRect();
      const fitScale = Math.min(pw / bound.width, ph / bound.height, 1);
      if (fitScale < 1) {
        obj.scaleX = (obj.scaleX || 1) * fitScale;
        obj.scaleY = (obj.scaleY || 1) * fitScale;
        obj.setCoords();
      }
    }

    rememberLastValidTransform(obj);
  }

  const boundaryFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashPrintAreaBoundary() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const boundary = canvas.getObjects().find((o: any) => (o as any).customName === PRINT_AREA_RECT_NAME);
    if (!boundary) return;

    boundary.set({ stroke: "#ef4444", strokeWidth: 3 });
    canvas.renderAll();

    if (boundaryFlashTimerRef.current) clearTimeout(boundaryFlashTimerRef.current);
    boundaryFlashTimerRef.current = setTimeout(() => {
      boundary.set({ stroke: "#6366f1", strokeWidth: 2 });
      canvas.renderAll();
      boundaryFlashTimerRef.current = null;
    }, 400);
  }

  function clampScaleInsidePrintArea(obj: any) {
    const coords = getCurrentPrintAreaCoords();
    if (!coords) return;
    const { px, py, pw, ph } = coords;

    // After scaling, clamp scale so bounding rect fits inside print area
    obj.setCoords();
    let bound = obj.getBoundingRect();

    // If it overflows, shrink scale to fit
    if (bound.width > pw || bound.height > ph) {
      const ratioW = pw / bound.width;
      const ratioH = ph / bound.height;
      const shrink = Math.min(ratioW, ratioH);
      obj.scaleX = (obj.scaleX || 1) * shrink;
      obj.scaleY = (obj.scaleY || 1) * shrink;
      obj.setCoords();
    }

    // Then clamp position
    clampObjectPositionInsidePrintArea(obj);
  }

  function enforcePrintAreaBounds(obj: any, mode: "move" | "scale" | "strict" = "strict") {
    if (!obj || (obj as any).customName === PRINT_AREA_RECT_NAME) return;

    if (isObjectInsidePrintArea(obj)) {
      rememberLastValidTransform(obj);
      return;
    }

    if (mode === "move") {
      const wasClamped = clampObjectPositionInsidePrintArea(obj);
      if (wasClamped && isObjectInsidePrintArea(obj)) {
        rememberLastValidTransform(obj);
        flashPrintAreaBoundary();
        return;
      }
    }

    if (mode === "scale") {
      clampScaleInsidePrintArea(obj);
      if (isObjectInsidePrintArea(obj)) {
        rememberLastValidTransform(obj);
        flashPrintAreaBoundary();
        return;
      }
    }

    restoreLastValidTransform(obj);
    if (!isObjectInsidePrintArea(obj)) {
      clampObjectPositionInsidePrintArea(obj);
    }

    if (isObjectInsidePrintArea(obj)) {
      rememberLastValidTransform(obj);
      flashPrintAreaBoundary();
    }
  }

  // Get center of print area in canvas coordinates, or fallback to canvas center
  function getPrintAreaCenter() {
    const canvas = fabricRef.current;
    if (!canvas) return { cx: 150, cy: 250 };
    const pa = getCurrentPrintArea();
    if (!pa) return { cx: canvas.getWidth() / 2, cy: canvas.getHeight() / 2 };
    const { px, py, pw, ph } = printAreaToCanvasCoords(pa);
    return { cx: px + pw / 2, cy: py + ph / 2 };
  }
  // Initialize canvas with responsive sizing
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) {
      console.log("[DesignStudio] Canvas init skipped - refs not ready");
      return;
    }

    if (fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }

    const container = containerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;
    console.log("[DesignStudio] Canvas init:", { w, h, embedMode, hasProduct: !!invProduct });

    const canvas = new FabricCanvas(canvasRef.current, {
      width: w,
      height: h,
      backgroundColor: "#ffffff",
      selection: true,
    });

    fabricRef.current = canvas;

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", () => setSelectedObject(null));
    canvas.on("object:modified", (e: any) => { if (!isLoadingViewRef.current) enforcePrintAreaBounds(e.target, "strict"); saveViewState(); saveState(); updateLayers(); });
    canvas.on("object:added", (e: any) => {
      if (isLoadingViewRef.current || (e.target as any)?.customName === PRINT_AREA_RECT_NAME) return;
      enforcePrintAreaBounds(e.target, "strict");
      saveViewState();
      updateLayers();
    });
    canvas.on("object:removed", (e: any) => { if ((e.target as any)?.customName === PRINT_AREA_RECT_NAME) return; saveViewState(); updateLayers(); });
    canvas.on("object:moving", (e: any) => { if (!isLoadingViewRef.current) enforcePrintAreaBounds(e.target, "move"); });
    canvas.on("object:scaling", (e: any) => { if (!isLoadingViewRef.current) enforcePrintAreaBounds(e.target, "scale"); });
    canvas.on("mouse:dblclick", (e: any) => {
      const target = e.target;
      if (target && target instanceof Group) {
        ungroupObject(target);
      }
    });

    saveState();
    setCanvasReady(true);

    // Resize observer to keep canvas responsive
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const liveCanvas = fabricRef.current;
        if (width <= 0 || height <= 0 || !liveCanvas) continue;

        const prevWidth = liveCanvas.getWidth();
        const prevHeight = liveCanvas.getHeight();
        if (prevWidth === width && prevHeight === height) continue;

        const prevBounds = imageBoundsRef.current;
        const aspectRatio = imageAspectRatioRef.current;

        liveCanvas.setDimensions({ width, height });

        if (prevBounds && aspectRatio) {
          const nextBounds = computeImageBoundsFromAspect(width, height, aspectRatio);
          remapCanvasObjectsToImageBounds(liveCanvas, prevBounds, nextBounds);
          imageBoundsRef.current = nextBounds;
          setImageBounds(nextBounds);
          updatePrintAreaRect(liveCanvas);
          saveViewState();
        }

        liveCanvas.renderAll();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      canvas.dispose();
      fabricRef.current = null;
      setCanvasReady(false);
    };
  }, [loading]);

  // Save/restore per-view canvas state when switching views
  useEffect(() => {
    if (!canvasReady || !fabricRef.current) return;
    const canvas = fabricRef.current;
    const mountedView = currentCanvasViewRef.current;

    const hasInventoryBackground = Boolean(getCurrentImageUrl());

    if (mountedView !== activeView) {
      saveViewState(mountedView);

      const savedState = viewStatesRef.current[activeView];
      const loadRequestId = ++viewLoadRequestRef.current;
      isLoadingViewRef.current = true;

      const finalizeViewLoad = (historyState: string) => {
        if (viewLoadRequestRef.current !== loadRequestId) return;
        canvas.getObjects().forEach((obj: any) => {
          if ((obj as any).customName !== PRINT_AREA_RECT_NAME) rememberLastValidTransform(obj);
        });
        canvas.backgroundImage = undefined;
        canvas.backgroundColor = hasInventoryBackground ? "rgba(0,0,0,0)" : selectedVariant?.hex || "#ffffff";
        updatePrintAreaRect(canvas);
        canvas.renderAll();
        updateLayers();
        setSelectedObject(null);
        setUndoStack([historyState]);
        setRedoStack([]);
        currentCanvasViewRef.current = activeView;
        isLoadingViewRef.current = false;
      };

      if (savedState) {
        canvas.loadFromJSON(savedState).then(() => {
          finalizeViewLoad(savedState);
        });
      } else {
        canvas.clear();
        const emptyState = JSON.stringify(canvas.toJSON());
        viewStatesRef.current[activeView] = emptyState;
        finalizeViewLoad(emptyState);
      }
    } else {
      canvas.backgroundImage = undefined;
      canvas.backgroundColor = hasInventoryBackground ? "rgba(0,0,0,0)" : selectedVariant?.hex || "#ffffff";
      updatePrintAreaRect(canvas);
      canvas.renderAll();
    }
  }, [activeView, invProduct, selectedVariant, canvasReady]);

  function handleSelection(e: any) {
    const obj = e.selected?.[0];
    if (obj) {
      setSelectedObject(obj);
      const objFill = (obj as any)._clipartColor || (typeof obj.fill === "string" ? obj.fill : "#000000");
      setObjectProps({
        opacity: Math.round((obj.opacity || 1) * 100),
        fill: objFill,
      });
      setFillColor(objFill);
    }
  }

  function updateLayers() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects()
      .filter((obj: any) => (obj as any).customName !== PRINT_AREA_RECT_NAME)
      .map((obj: any, i: number) => ({
        id: i,
        type: obj.type,
        name: obj.customName || `${obj.type} ${i + 1}`,
        visible: obj.visible !== false,
        locked: obj.lockMovementX && obj.lockMovementY,
        obj,
      }));
    setLayers([...objects].reverse());
  }

  function saveState() {
    const canvas = fabricRef.current;
    if (!canvas || isLoadingViewRef.current) return;
    const json = JSON.stringify(canvas.toJSON());
    viewStatesRef.current[currentCanvasViewRef.current] = json;
    setUndoStack((prev) => [...prev, json]);
    setRedoStack([]);
  }

  function undo() {
    const canvas = fabricRef.current;
    if (!canvas || undoStack.length <= 1) return;
    const view = currentCanvasViewRef.current;
    const newUndo = [...undoStack];
    const current = newUndo.pop()!;
    setRedoStack((prev) => [...prev, current]);
    const prev = newUndo[newUndo.length - 1];
    setUndoStack(newUndo);
    isLoadingViewRef.current = true;
    canvas.loadFromJSON(prev).then(() => {
      canvas.getObjects().forEach((obj: any) => {
        if ((obj as any).customName !== PRINT_AREA_RECT_NAME) rememberLastValidTransform(obj);
      });
      canvas.renderAll();
      updateLayers();
      viewStatesRef.current[view] = JSON.stringify(canvas.toJSON());
      isLoadingViewRef.current = false;
    });
  }

  function redo() {
    const canvas = fabricRef.current;
    if (!canvas || redoStack.length === 0) return;
    const view = currentCanvasViewRef.current;
    const newRedo = [...redoStack];
    const next = newRedo.pop()!;
    setRedoStack(newRedo);
    setUndoStack((prev) => [...prev, next]);
    isLoadingViewRef.current = true;
    canvas.loadFromJSON(next).then(() => {
      canvas.getObjects().forEach((obj: any) => {
        if ((obj as any).customName !== PRINT_AREA_RECT_NAME) rememberLastValidTransform(obj);
      });
      canvas.renderAll();
      updateLayers();
      viewStatesRef.current[view] = JSON.stringify(canvas.toJSON());
      isLoadingViewRef.current = false;
    });
  }

  function addText() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    loadGoogleFont(fontFamily);
    const { cx, cy } = getPrintAreaCenter();
    const text = new FabricText(textInput, {
      left: cx, top: cy, fontSize, fill: fillColor, fontFamily, originX: 'center', originY: 'center',
    });
    (text as any).customName = `Text: "${textInput.slice(0, 12)}"`;
    canvas.add(text);
    canvas.setActiveObject(text);
    saveState();
  }

  function createArchPath(radius: number, sweep: number = 180): Path {
    const startAngle = (180 - sweep) / 2;
    const endAngle = startAngle + sweep;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = radius + radius * Math.cos(Math.PI - startRad);
    const y1 = radius - radius * Math.sin(Math.PI - startRad);
    const x2 = radius + radius * Math.cos(Math.PI - endRad);
    const y2 = radius - radius * Math.sin(Math.PI - endRad);
    const largeArc = sweep > 180 ? 1 : 0;
    const pathStr = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    return new Path(pathStr, { visible: false, fill: undefined, stroke: undefined });
  }

  function addArchText() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    loadGoogleFont(fontFamily);
    const radius = 200;
    const archPath = createArchPath(radius, 180);
    const { cx, cy } = getPrintAreaCenter();
    const text = new FabricText(textInput, {
      left: cx, top: cy, fontSize, fill: fillColor, fontFamily, originX: 'center', originY: 'center',
      path: archPath,
    });
    (text as any).customName = `Arch: "${textInput.slice(0, 12)}"`;
    (text as any)._archRadius = radius;
    (text as any)._archSweep = 180;
    canvas.add(text);
    canvas.setActiveObject(text);
    saveState();
  }

  function updateArchCurve(sweep: number) {
    if (!selectedObject || selectedObject.type !== "text") return;
    const radius = (selectedObject as any)._archRadius || 200;
    if (sweep <= 0) {
      selectedObject.set("path", undefined);
      (selectedObject as any)._archSweep = 0;
    } else {
      const archPath = createArchPath(radius, sweep);
      selectedObject.set("path", archPath);
      (selectedObject as any)._archSweep = sweep;
    }
    (selectedObject as any)._archRadius = radius;
    fabricRef.current?.renderAll();
    saveState();
  }

  function updateArchRadius(radius: number) {
    if (!selectedObject || selectedObject.type !== "text") return;
    const sweep = (selectedObject as any)._archSweep || 180;
    if (sweep <= 0) return;
    const archPath = createArchPath(radius, sweep);
    selectedObject.set("path", archPath);
    (selectedObject as any)._archRadius = radius;
    fabricRef.current?.renderAll();
    saveState();
  }

  function addTextTemplate(template: TextTemplate) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const textObjects: FabricText[] = [];
    let yOffset = 0;
    template.lines.forEach((line) => {
      let displayText = line.text;
      if (line.textTransform === "uppercase") displayText = line.text.toUpperCase();
      else if (line.textTransform === "lowercase") displayText = line.text.toLowerCase();
      const text = new FabricText(displayText, {
        left: 0,
        top: yOffset,
        fontSize: line.fontSize,
        fill: fillColor,
        fontFamily: line.fontFamily,
        fontWeight: (line.fontWeight || "normal") as any,
        fontStyle: (line.fontStyle || "normal") as any,
        charSpacing: line.letterSpacing ? parseInt(line.letterSpacing) * 10 : 0,
      });
      (text as any).customName = `Text: "${displayText.slice(0, 12)}"`;
      textObjects.push(text);
      yOffset += line.fontSize + 8;
    });
    const group = new Group(textObjects, {
      left: 100,
      top: 200,
    });
    (group as any).customName = `Template: ${template.name}`;
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
    saveState();
  }

  function ungroupObject(group: Group) {
    const canvas = fabricRef.current;
    if (!canvas || !(group instanceof Group)) return;
    const groupCenter = group.getCenterPoint();
    const groupAngle = group.angle || 0;
    const groupScaleX = group.scaleX || 1;
    const groupScaleY = group.scaleY || 1;

    // Gather item data while still in group
    const itemData = (group as any)._objects.map((item: any) => ({
      left: item.left || 0,
      top: item.top || 0,
      scaleX: item.scaleX || 1,
      scaleY: item.scaleY || 1,
      angle: item.angle || 0,
    }));

    const items = group.removeAll();
    canvas.remove(group);

    items.forEach((item: any, i: number) => {
      const data = itemData[i];
      const rad = (groupAngle * Math.PI) / 180;
      const scaledX = data.left * groupScaleX;
      const scaledY = data.top * groupScaleY;
      const rotatedX = scaledX * Math.cos(rad) - scaledY * Math.sin(rad);
      const rotatedY = scaledX * Math.sin(rad) + scaledY * Math.cos(rad);
      item.set({
        left: groupCenter.x + rotatedX,
        top: groupCenter.y + rotatedY,
        scaleX: data.scaleX * groupScaleX,
        scaleY: data.scaleY * groupScaleY,
        angle: data.angle + groupAngle,
      });
      item.setCoords();
      canvas.add(item);
    });
    canvas.renderAll();
    updateLayers();
    saveState();
  }

  function addShape(shape: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let obj: any;
    const { cx, cy } = getPrintAreaCenter();
    const commonProps = { left: cx, top: cy, fill: fillColor, originX: 'center' as const, originY: 'center' as const };
    switch (shape) {
      case "rect":
        obj = new Rect({ ...commonProps, width: 120, height: 100, rx: 8, ry: 8 });
        (obj as any).customName = "Rectangle";
        break;
      case "roundedRect":
        obj = new Rect({ ...commonProps, width: 120, height: 80, rx: 24, ry: 24 });
        (obj as any).customName = "Rounded Rect";
        break;
      case "circle":
        obj = new Circle({ ...commonProps, radius: 60 });
        (obj as any).customName = "Circle";
        break;
      case "ellipse":
        obj = new Ellipse({ ...commonProps, rx: 80, ry: 50 });
        (obj as any).customName = "Ellipse";
        break;
      case "triangle":
        obj = new Triangle({ ...commonProps, width: 120, height: 100 });
        (obj as any).customName = "Triangle";
        break;
      case "pentagon": {
        const pts = Array.from({ length: 5 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          return { x: 60 + 60 * Math.cos(a), y: 60 + 60 * Math.sin(a) };
        });
        obj = new Polygon(pts, { ...commonProps });
        (obj as any).customName = "Pentagon";
        break;
      }
      case "hexagon": {
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 6 - Math.PI / 6;
          return { x: 60 + 60 * Math.cos(a), y: 60 + 60 * Math.sin(a) };
        });
        obj = new Polygon(pts, { ...commonProps });
        (obj as any).customName = "Hexagon";
        break;
      }
      case "star": {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI * 2 * i) / 10 - Math.PI / 2;
          const r = i % 2 === 0 ? 60 : 28;
          pts.push({ x: 60 + r * Math.cos(a), y: 60 + r * Math.sin(a) });
        }
        obj = new Polygon(pts, { ...commonProps });
        (obj as any).customName = "Star";
        break;
      }
      case "arrow": {
        const pts = [
          { x: 0, y: 30 }, { x: 80, y: 30 }, { x: 80, y: 10 },
          { x: 120, y: 45 }, { x: 80, y: 80 }, { x: 80, y: 60 }, { x: 0, y: 60 },
        ];
        obj = new Polygon(pts, { ...commonProps });
        (obj as any).customName = "Arrow";
        break;
      }
      case "line":
        obj = new FabricLine([0, 0, 150, 0], { ...commonProps, stroke: fillColor, strokeWidth: 4, fill: undefined });
        (obj as any).customName = "Line";
        break;
      case "cross": {
        const pts = [
          { x: 30, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 30 }, { x: 90, y: 30 },
          { x: 90, y: 60 }, { x: 60, y: 60 }, { x: 60, y: 90 }, { x: 30, y: 90 },
          { x: 30, y: 60 }, { x: 0, y: 60 }, { x: 0, y: 30 }, { x: 30, y: 30 },
        ];
        obj = new Polygon(pts, { ...commonProps });
        (obj as any).customName = "Cross";
        break;
      }
      default: return;
    }
    canvas.add(obj);
    canvas.setActiveObject(obj);
    saveState();
  }

  function addPattern(patternType: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const size = 120;
    const patternCanvas = document.createElement("canvas");
    const ctx = patternCanvas.getContext("2d");
    if (!ctx) return;

    const tileSize = 20;
    patternCanvas.width = tileSize;
    patternCanvas.height = tileSize;

    ctx.clearRect(0, 0, tileSize, tileSize);
    ctx.strokeStyle = fillColor;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = 2;

    switch (patternType) {
      case "stripes":
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(tileSize, tileSize);
        ctx.moveTo(-tileSize / 2, tileSize / 2); ctx.lineTo(tileSize / 2, tileSize * 1.5);
        ctx.moveTo(tileSize / 2, -tileSize / 2); ctx.lineTo(tileSize * 1.5, tileSize / 2);
        ctx.stroke();
        break;
      case "dots":
        ctx.beginPath();
        ctx.arc(tileSize / 2, tileSize / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "grid":
        ctx.beginPath();
        ctx.moveTo(tileSize, 0); ctx.lineTo(tileSize, tileSize);
        ctx.moveTo(0, tileSize); ctx.lineTo(tileSize, tileSize);
        ctx.stroke();
        break;
      case "checkerboard":
        ctx.fillRect(0, 0, tileSize / 2, tileSize / 2);
        ctx.fillRect(tileSize / 2, tileSize / 2, tileSize / 2, tileSize / 2);
        break;
      case "zigzag":
        ctx.beginPath();
        ctx.moveTo(0, tileSize / 2);
        ctx.lineTo(tileSize / 4, 0);
        ctx.lineTo(tileSize / 2, tileSize / 2);
        ctx.lineTo(tileSize * 3 / 4, 0);
        ctx.lineTo(tileSize, tileSize / 2);
        ctx.stroke();
        break;
      case "crosshatch":
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(tileSize, tileSize);
        ctx.moveTo(tileSize, 0); ctx.lineTo(0, tileSize);
        ctx.stroke();
        break;
      case "horizontal":
        ctx.beginPath();
        ctx.moveTo(0, tileSize / 2); ctx.lineTo(tileSize, tileSize / 2);
        ctx.stroke();
        break;
      case "vertical":
        ctx.beginPath();
        ctx.moveTo(tileSize / 2, 0); ctx.lineTo(tileSize / 2, tileSize);
        ctx.stroke();
        break;
      default: return;
    }

    const fabricPattern = new Pattern({
      source: patternCanvas,
      repeat: "repeat",
    });
    const { cx, cy } = getPrintAreaCenter();
    const rect = new Rect({
      left: cx, top: cy, width: size, height: size, originX: 'center', originY: 'center',
      fill: fabricPattern,
      stroke: fillColor,
      strokeWidth: 1,
    });
    (rect as any).customName = patternType.charAt(0).toUpperCase() + patternType.slice(1) + " Pattern";
    (rect as any)._patternType = patternType;
    (rect as any)._patternColor = fillColor;
    canvas.add(rect);
    canvas.setActiveObject(rect);
    saveState();
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const canvas = fabricRef.current;
    const file = e.target.files?.[0];
    if (!canvas || !file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const imgEl = new Image();
      imgEl.onload = () => {
        const { cx, cy } = getPrintAreaCenter();
        const scale = Math.min(300 / imgEl.width, 300 / imgEl.height, 1);
        const img = new FabricImage(imgEl, {
          left: cx, top: cy, originX: 'center', originY: 'center',
          scaleX: scale,
          scaleY: scale,
        });
        (img as any).customName = file.name.slice(0, 20);
        canvas.add(img);
        canvas.setActiveObject(img);
        saveState();
      };
      imgEl.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function deleteSelected() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) { canvas.remove(active); setSelectedObject(null); saveState(); }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        deleteSelected();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function toggleVisibility(layerObj: any) {
    layerObj.visible = !layerObj.visible;
    fabricRef.current?.renderAll();
    updateLayers();
  }

  function toggleLock(layerObj: any) {
    const locked = !(layerObj.lockMovementX && layerObj.lockMovementY);
    layerObj.lockMovementX = locked;
    layerObj.lockMovementY = locked;
    layerObj.lockScalingX = locked;
    layerObj.lockScalingY = locked;
    layerObj.lockRotation = locked;
    layerObj.selectable = !locked;
    fabricRef.current?.renderAll();
    updateLayers();
  }

  function moveLayer(index: number, direction: "up" | "down") {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    const reversedIndex = objects.length - 1 - index;
    const obj = objects[reversedIndex];
    if (!obj) return;
    if (direction === "up") canvas.bringObjectForward(obj);
    else canvas.sendObjectBackwards(obj);
    canvas.renderAll();
    updateLayers();
    saveState();
  }

  function updateSelectedProp(prop: string, value: any) {
    if (!selectedObject) return;
    if (prop === "opacity") {
      selectedObject.set("opacity", value / 100);
      setObjectProps((p) => ({ ...p, opacity: value }));
    } else if (prop === "fill") {
      updateFillColor(value);
      return;
    }
    fabricRef.current?.renderAll();
    saveState();
  }

  function updateFillColor(value: string) {
    setFillColor(value);
    if (selectedObject) {
      const canvas = fabricRef.current;
      // For clipart (FabricImage from SVG), re-render with new color
      if ((selectedObject as any)._clipartIconName && selectedObject instanceof FabricImage) {
        const iconName = (selectedObject as any)._clipartIconName;
        // Find the icon component
        let iconComp: React.ComponentType<any> | null = null;
        for (const cat of Object.values(CLIPART_CATEGORIES)) {
          const found = cat.find(c => c.name === iconName);
          if (found) { iconComp = found.icon; break; }
        }
        if (iconComp) {
          const svgString = ReactDOMServer.renderToStaticMarkup(
            React.createElement(iconComp, { size: 120, color: value, strokeWidth: 1.5 })
          );
          const blob = new Blob([svgString], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);
          const imgEl = new Image();
          imgEl.onload = () => {
            const prevLeft = selectedObject.left;
            const prevTop = selectedObject.top;
            const prevScaleX = selectedObject.scaleX;
            const prevScaleY = selectedObject.scaleY;
            const prevAngle = selectedObject.angle;
            const newImg = new FabricImage(imgEl, {
              left: prevLeft, top: prevTop,
              scaleX: prevScaleX, scaleY: prevScaleY,
              angle: prevAngle,
              originX: selectedObject.originX,
              originY: selectedObject.originY,
            });
            (newImg as any).customName = (selectedObject as any).customName;
            (newImg as any)._clipartIconName = iconName;
            (newImg as any)._clipartColor = value;
            canvas?.remove(selectedObject);
            canvas?.add(newImg);
            canvas?.setActiveObject(newImg);
            canvas?.renderAll();
            saveState();
            URL.revokeObjectURL(url);
          };
          imgEl.src = url;
        }
    } else if (selectedObject instanceof Group) {
        // For groups (e.g. text templates), update fill on all children
        selectedObject.getObjects().forEach((child: any) => {
          child.set("fill", value);
        });
        setObjectProps((p) => ({ ...p, fill: value }));
        fabricRef.current?.renderAll();
        saveState();
      } else if ((selectedObject as any)._patternType) {
        // Re-create pattern with new color
        const patternType = (selectedObject as any)._patternType;
        const tileSize = 20;
        const patternCanvas = document.createElement("canvas");
        patternCanvas.width = tileSize;
        patternCanvas.height = tileSize;
        const ctx = patternCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, tileSize, tileSize);
          ctx.strokeStyle = value;
          ctx.fillStyle = value;
          ctx.lineWidth = 2;
          switch (patternType) {
            case "stripes":
              ctx.beginPath();
              ctx.moveTo(0, 0); ctx.lineTo(tileSize, tileSize);
              ctx.moveTo(-tileSize / 2, tileSize / 2); ctx.lineTo(tileSize / 2, tileSize * 1.5);
              ctx.moveTo(tileSize / 2, -tileSize / 2); ctx.lineTo(tileSize * 1.5, tileSize / 2);
              ctx.stroke();
              break;
            case "dots":
              ctx.beginPath();
              ctx.arc(tileSize / 2, tileSize / 2, 3, 0, Math.PI * 2);
              ctx.fill();
              break;
            case "grid":
              ctx.beginPath();
              ctx.moveTo(tileSize, 0); ctx.lineTo(tileSize, tileSize);
              ctx.moveTo(0, tileSize); ctx.lineTo(tileSize, tileSize);
              ctx.stroke();
              break;
            case "checkerboard":
              ctx.fillRect(0, 0, tileSize / 2, tileSize / 2);
              ctx.fillRect(tileSize / 2, tileSize / 2, tileSize / 2, tileSize / 2);
              break;
            case "zigzag":
              ctx.beginPath();
              ctx.moveTo(0, tileSize / 2);
              ctx.lineTo(tileSize / 4, 0);
              ctx.lineTo(tileSize / 2, tileSize / 2);
              ctx.lineTo(tileSize * 3 / 4, 0);
              ctx.lineTo(tileSize, tileSize / 2);
              ctx.stroke();
              break;
            case "crosshatch":
              ctx.beginPath();
              ctx.moveTo(0, 0); ctx.lineTo(tileSize, tileSize);
              ctx.moveTo(tileSize, 0); ctx.lineTo(0, tileSize);
              ctx.stroke();
              break;
            case "horizontal":
              ctx.beginPath();
              ctx.moveTo(0, tileSize / 2); ctx.lineTo(tileSize, tileSize / 2);
              ctx.stroke();
              break;
            case "vertical":
              ctx.beginPath();
              ctx.moveTo(tileSize / 2, 0); ctx.lineTo(tileSize / 2, tileSize);
              ctx.stroke();
              break;
          }
          const fabricPattern = new Pattern({ source: patternCanvas, repeat: "repeat" });
          selectedObject.set("fill", fabricPattern);
          selectedObject.set("stroke", value);
          (selectedObject as any)._patternColor = value;
          setObjectProps((p) => ({ ...p, fill: value }));
          fabricRef.current?.renderAll();
          saveState();
        }
      } else {
        selectedObject.set("fill", value);
        setObjectProps((p) => ({ ...p, fill: value }));
        fabricRef.current?.renderAll();
        saveState();
      }
    }
  }

  // Determine product info
  const productName = invProduct?.name || "Product";
  const bgImageUrl = getCurrentImageUrl();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-editor-bg text-sidebar-foreground">
        <p>Loading product...</p>
      </div>
    );
  }

  if (!invProduct && !embedMode) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold">Product not found</h2>
          <Link to="/" className="mt-4 inline-block">
            <Button variant="outline">← Back home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (exportComplete && embedMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--editor-bg))]">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-green-400">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-sidebar-foreground">Design Submitted!</h2>
          <p className="text-sm text-muted-foreground">Your custom design has been saved. You can close this window.</p>
        </div>
      </div>
    );
  }

  function deleteLayer(layerObj: any) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.remove(layerObj);
    if (selectedObject === layerObj) setSelectedObject(null);
    saveState();
  }

  function duplicateLayer(layerObj: any) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    layerObj.clone().then((cloned: any) => {
      cloned.set({ left: (cloned.left || 0) + 15, top: (cloned.top || 0) + 15 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
      saveState();
    });
  }

  // Chroma-key: replace bright green (#00FF00) background with transparency
  function chromaKeyGreen(imgSrc: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context unavailable"));
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, c.width, c.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          // Detect green-screen pixels: high green, low red & blue
          if (g > 180 && r < 100 && b < 100) {
            d[i + 3] = 0; // fully transparent
          } else if (g > 150 && r < 130 && b < 130 && g > r * 1.4 && g > b * 1.4) {
            // Edge pixels with green fringing - partial transparency
            const greenness = (g - Math.max(r, b)) / g;
            d[i + 3] = Math.round(255 * (1 - greenness));
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image for chroma key"));
      img.src = imgSrc;
    });
  }

  // Check if the currently selected object is an AI Design
  function getSelectedAiDesign(): any | null {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    const active = canvas.getActiveObject();
    if (active && (active as any).customName === "AI Design") return active;
    return null;
  }

  const isEditMode = !!getSelectedAiDesign();

  // Extract the current image of the selected AI design as a data URL
  function extractAiDesignImage(obj: any): string | null {
    try {
      const el = obj.getElement?.();
      if (!el) return null;
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = el.naturalWidth || el.width;
      tempCanvas.height = el.naturalHeight || el.height;
      const ctx = tempCanvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(el, 0, 0);
      return tempCanvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  async function generateAiDesign(forceNew = false) {
    if (!aiPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    try {
      const selectedAi = !forceNew ? getSelectedAiDesign() : null;
      let sourceImage: string | undefined;
      if (selectedAi) {
        sourceImage = extractAiDesignImage(selectedAi) || undefined;
      }

      const styledPrompt = aiStyle ? `${aiStyle} style: ${aiPrompt.trim()}` : aiPrompt.trim();

      const { data, error } = await supabase.functions.invoke("generate-design", {
        body: { prompt: styledPrompt, ...(sourceImage ? { sourceImage } : {}) },
      });
      if (error) throw new Error(error.message || "Generation failed");
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error("No image generated");

      const imageUrl = data.imageUrl;
      setAiHistory((prev) => [{ prompt: aiPrompt.trim(), imageUrl }, ...prev.slice(0, 9)]);

      if (selectedAi) {
        // Edit mode: replace image in-place, keeping position/scale/rotation
        replaceAiDesignImage(selectedAi, imageUrl);
      } else {
        addAiImageToCanvas(imageUrl);
      }
      setAiPrompt("");
    } catch (err: any) {
      console.error("AI generation error:", err);
      alert(err.message || "Failed to generate design. Try again.");
    } finally {
      setAiGenerating(false);
    }
  }

  function replaceAiDesignImage(existingObj: any, newImageUrl: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const imgEl = new Image();
    imgEl.crossOrigin = "anonymous";
    imgEl.onload = () => {
      // Preserve transforms
      const props = {
        left: existingObj.left,
        top: existingObj.top,
        scaleX: existingObj.scaleX,
        scaleY: existingObj.scaleY,
        angle: existingObj.angle,
        flipX: existingObj.flipX,
        flipY: existingObj.flipY,
        opacity: existingObj.opacity,
      };
      const newImg = new FabricImage(imgEl, props);
      (newImg as any).customName = "AI Design";
      canvas.remove(existingObj);
      canvas.add(newImg);
      canvas.setActiveObject(newImg);
      saveState();
    };
    imgEl.onerror = () => console.error("Failed to load edited AI image");
    imgEl.src = newImageUrl;
  }

  function addAiImageToCanvas(imageUrl: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const imgEl = new Image();
    imgEl.crossOrigin = "anonymous";
    imgEl.onload = () => {
      const { cx, cy } = getPrintAreaCenter();
      const scale = Math.min(300 / imgEl.width, 300 / imgEl.height, 1);
      const img = new FabricImage(imgEl, {
        left: cx, top: cy, originX: 'center', originY: 'center',
        scaleX: scale, scaleY: scale,
      });
      (img as any).customName = "AI Design";
      canvas.add(img);
      canvas.setActiveObject(img);
      saveState();
    };
    imgEl.onerror = () => {
      console.error("Failed to load AI generated image");
    };
    imgEl.src = imageUrl;
  }

  async function removeBackground() {
    const canvas = fabricRef.current;
    if (!canvas || removingBg) return;
    const active = canvas.getActiveObject();
    if (!active || !(active as any).getElement) return;

    const sourceUrl = extractAiDesignImage(active);
    if (!sourceUrl) {
      alert("Could not extract image data.");
      return;
    }

    setRemovingBg(true);
    try {
      const { data, error } = await supabase.functions.invoke("remove-background", {
        body: { imageUrl: sourceUrl },
      });
      if (error) throw new Error(error.message || "Background removal failed");
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error("No image returned");

      // Convert green-screen background to actual transparency
      const transparentUrl = await chromaKeyGreen(data.imageUrl);
      replaceAiDesignImage(active, transparentUrl);
    } catch (err: any) {
      console.error("Remove background error:", err);
      alert(err.message || "Failed to remove background. Try again.");
    } finally {
      setRemovingBg(false);
    }
  }

  function addClipart(clipartItem: { name: string; icon: React.ComponentType<any> }) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const svgString = ReactDOMServer.renderToStaticMarkup(
      React.createElement(clipartItem.icon, { size: 120, color: fillColor, strokeWidth: 1.5 })
    );
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const imgEl = new Image();
    imgEl.onload = () => {
      const { cx, cy } = getPrintAreaCenter();
      const img = new FabricImage(imgEl, {
        left: cx, top: cy, originX: 'center', originY: 'center',
        scaleX: 1, scaleY: 1,
      });
      (img as any).customName = `Clipart: ${clipartItem.name}`;
      (img as any)._clipartIconName = clipartItem.name;
      (img as any)._clipartColor = fillColor;
      canvas.add(img);
      canvas.setActiveObject(img);
      saveState();
      URL.revokeObjectURL(url);
    };
    imgEl.src = url;
  }

  // Export all views as PNGs and post result
  async function exportAndComplete() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setExporting(true);

    try {
      // Save current view state
      viewStatesRef.current[activeView] = JSON.stringify(canvas.toJSON());

      const sides: Array<{ view: string; designPNG: string; previewPNG?: string; productImage: string; canvasJSON: string; printArea?: { x: number; y: number; width: number; height: number } }> = [];

      const imageMap: Record<string, string | null> = {
        front: invProduct?.image_front || null,
        back: invProduct?.image_back || null,
        side1: invProduct?.image_side1 || null,
        side2: invProduct?.image_side2 || null,
      };

      const loadImageForComposite = async (src: string) => {
        let resolvedSrc = src;
        let objectUrl: string | null = null;

        if (src && !src.startsWith("data:")) {
          try {
            const response = await fetch(src);
            const blob = await response.blob();
            objectUrl = URL.createObjectURL(blob);
            resolvedSrc = objectUrl;
          } catch (err) {
            console.warn("Falling back to direct image load for composite:", err);
          }
        }

        return await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            resolve(img);
          };
          img.onerror = () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            reject(new Error(`Failed to load image: ${src}`));
          };
          img.src = resolvedSrc;
        });
      };

      const uploadPng = async (pngUrl: string, suffix: string) => {
        let publicUrl = pngUrl;

        try {
          const blob = await (await fetch(pngUrl)).blob();
          const fileName = `${sessionId || "export"}_${suffix}_${Date.now()}.png`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("design-exports")
            .upload(fileName, blob, { contentType: "image/png" });

          if (uploadData && !uploadError) {
            publicUrl = supabase.storage.from("design-exports").getPublicUrl(uploadData.path).data.publicUrl;
          }
        } catch (uploadErr) {
          console.warn("Storage upload failed, using data URL:", uploadErr);
        }

        return publicUrl;
      };

      const FIXED_RENDER_SIZE = 1200;

      const generateCompositePreview = async (
        productImg: HTMLImageElement | null,
        fullCanvasDataUrl: string,
        canvasWidth: number,
        canvasHeight: number,
      ) => {
        if (!fullCanvasDataUrl) return "";
        if (!productImg) return fullCanvasDataUrl;

        try {
          const canvasImg = await loadImageForComposite(fullCanvasDataUrl);

          // Always render at a fixed size so the output is identical regardless of viewport
          const outW = FIXED_RENDER_SIZE;
          const outH = FIXED_RENDER_SIZE;

          const previewCanvas = document.createElement("canvas");
          previewCanvas.width = outW;
          previewCanvas.height = outH;
          const ctx = previewCanvas.getContext("2d");
          if (!ctx) return fullCanvasDataUrl;

          ctx.clearRect(0, 0, outW, outH);

          // Draw product image with object-contain
          const natW = productImg.naturalWidth || productImg.width;
          const natH = productImg.naturalHeight || productImg.height;
          const scale = Math.min(outW / natW, outH / natH);
          const prodW = natW * scale;
          const prodH = natH * scale;
          const prodX = (outW - prodW) / 2;
          const prodY = (outH - prodH) / 2;
          ctx.drawImage(productImg, prodX, prodY, prodW, prodH);

          // Draw design overlay scaled to the same fixed size
          ctx.drawImage(canvasImg, 0, 0, outW, outH);

          return previewCanvas.toDataURL("image/png");
        } catch (err) {
          console.warn("Composite preview generation failed:", err);
          return fullCanvasDataUrl;
        }
      };

      for (const view of availableViews) {
        const stateJson = viewStatesRef.current[view];
        if (!stateJson) {
          sides.push({ view, designPNG: "", previewPNG: "", productImage: imageMap[view] || "", canvasJSON: "{}" });
          continue;
        }

        let cleanedJson = stateJson;
        if (typeof cleanedJson === "string" && cleanedJson.includes("blob:")) {
          try {
            const parsed = JSON.parse(cleanedJson);
            const replaceBlobUrls = (obj: any) => {
              if (!obj) return;
              if (typeof obj === "object") {
                for (const key of Object.keys(obj)) {
                  if (typeof obj[key] === "string" && obj[key].startsWith("blob:")) {
                    obj[key] = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualzQAAAABJRU5ErkJggg==";
                  } else if (typeof obj[key] === "object") {
                    replaceBlobUrls(obj[key]);
                  }
                }
              }
            };
            replaceBlobUrls(parsed);
            cleanedJson = JSON.stringify(parsed);
          } catch (e) {
            console.warn("Failed to clean blob URLs from canvas JSON:", e);
          }
        }

        await canvas.loadFromJSON(cleanedJson);
        canvas.backgroundColor = "rgba(0,0,0,0)";
        canvas.backgroundImage = undefined;

        const paRects = canvas.getObjects().filter((o: any) => (o as any).customName === PRINT_AREA_RECT_NAME);
        paRects.forEach((o) => canvas.remove(o));
        canvas.renderAll();

        const viewKey = view === "side1" ? "side1" : view === "side2" ? "side2" : view;
        const pa = invProduct?.print_areas?.[viewKey];
        const cw = canvas.getWidth();
        const ch = canvas.getHeight();
        const productImageUrl = imageMap[view] || null;

        let productImg: HTMLImageElement | null = null;
        let viewImageBounds: { x: number; y: number; w: number; h: number } | null = null;

        if (productImageUrl) {
          try {
            productImg = await loadImageForComposite(productImageUrl);
            const naturalWidth = productImg.naturalWidth || productImg.width || cw;
            const naturalHeight = productImg.naturalHeight || productImg.height || ch;
            viewImageBounds = computeImageBounds(cw, ch, naturalWidth, naturalHeight);
          } catch (productErr) {
            console.warn(`Failed to load product image for ${view} preview:`, productErr);
          }
        }

        const exportOptions: any = { format: "png", multiplier: 4 };
        if (pa) {
          if (viewImageBounds) {
            exportOptions.left = viewImageBounds.x + (pa.x / 100) * viewImageBounds.w;
            exportOptions.top = viewImageBounds.y + (pa.y / 100) * viewImageBounds.h;
            exportOptions.width = (pa.width / 100) * viewImageBounds.w;
            exportOptions.height = (pa.height / 100) * viewImageBounds.h;
          } else {
            exportOptions.left = (pa.x / 100) * cw;
            exportOptions.top = (pa.y / 100) * ch;
            exportOptions.width = (pa.width / 100) * cw;
            exportOptions.height = (pa.height / 100) * ch;
          }
        }

        const dataUrl = canvas.toDataURL(exportOptions);
        const publicUrl = await uploadPng(dataUrl, view);
        const fullCanvasDataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
        const previewDataUrl = await generateCompositePreview(productImg, fullCanvasDataUrl, cw, ch);
        const previewUrl = await uploadPng(previewDataUrl, `${view}_preview`);

        sides.push({
          view,
          designPNG: publicUrl,
          previewPNG: previewUrl,
          productImage: productImageUrl || "",
          canvasJSON: stateJson,
          printArea: pa || undefined,
        });
      }

      // Restore current view
      const currentState = viewStatesRef.current[activeView];
      if (currentState) {
        await canvas.loadFromJSON(currentState);
        canvas.renderAll();
      }

      const result = {
        sessionId,
        sides,
        variant: selectedVariant || null,
      };

      // If embed mode, complete session and post message to parent
      if (embedMode && sessionId) {
        try {
          await supabase.functions.invoke("complete-session", {
            body: { sessionId, designOutput: result },
          });
        } catch (sessionErr) {
          console.warn("Session completion API call failed:", sessionErr);
        }

        window.parent.postMessage(
          { source: "customizer-studio", type: "design-complete", payload: result },
          "*"
        );
      }

      setExportComplete(true);
      return result;
    } catch (err) {
      console.error("Export error:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  function handleCancel() {
    if (embedMode) {
      window.parent.postMessage(
        { source: "customizer-studio", type: "design-cancel" },
        "*"
      );
    } else {
      navigate(-1);
    }
  }

  const tools = [
    { id: "ai", icon: Wand2, label: "AI" },
    { id: "text", icon: Type, label: "Text" },
    { id: "shapes", icon: Square, label: "Shapes" },
    { id: "clipart", icon: Sticker, label: "Clipart" },
    { id: "upload", icon: Upload, label: "Upload" },
    { id: "layers", icon: LayersIcon, label: "Layers" },
  ];

  function updateSelectedText(newText: string) {
    if (!selectedObject || selectedObject.type !== "text") return;
    selectedObject.set("text", newText);
    (selectedObject as any).customName = `Text: "${newText.slice(0, 12)}"`;
    fabricRef.current?.renderAll();
    updateLayers();
    saveState();
  }

  function updateSelectedFontSize(size: number) {
    if (!selectedObject || selectedObject.type !== "text") return;
    selectedObject.set("fontSize", size);
    fabricRef.current?.renderAll();
    saveState();
  }

  const selectedPropertiesPanel = selectedObject ? (
    <div className="space-y-3 border border-sidebar-border rounded-lg p-3 bg-sidebar-accent/30">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Selected Object</h4>
      {selectedObject.type === "text" && (
        <>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Text</label>
            <Input
              value={selectedObject.text || ""}
              onChange={(e) => updateSelectedText(e.target.value)}
              className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Font Size: {selectedObject.fontSize}px</label>
            <Slider
              value={[selectedObject.fontSize || 32]}
              onValueChange={([v]) => updateSelectedFontSize(v)}
              min={12} max={120} step={1}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Font Family</label>
            <Select
              value={selectedObject.fontFamily || "Inter"}
              onValueChange={(val) => {
                loadGoogleFont(val);
                selectedObject.set("fontFamily", val);
                fabricRef.current?.renderAll();
                saveState();
              }}
            >
              <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {GOOGLE_FONTS.map((f) => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Arch Curve: {(selectedObject as any)._archSweep || 0}°
            </label>
            <Slider
              value={[(selectedObject as any)._archSweep || 0]}
              onValueChange={([v]) => updateArchCurve(v)}
              min={0} max={350} step={5}
            />
          </div>
          {((selectedObject as any)._archSweep || 0) > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Arch Radius: {(selectedObject as any)._archRadius || 200}px
              </label>
              <Slider
                value={[(selectedObject as any)._archRadius || 200]}
                onValueChange={([v]) => updateArchRadius(v)}
                min={50} max={500} step={10}
              />
            </div>
          )}
        </>
      )}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Opacity: {objectProps.opacity}%</label>
        <Slider value={[objectProps.opacity]} onValueChange={([v]) => updateSelectedProp("opacity", v)} min={0} max={100} />
      </div>
      <Button variant="destructive" size="sm" onClick={deleteSelected} className="w-full gap-2">
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
    </div>
  ) : null;

  return (
    <div className="flex h-screen flex-col bg-editor-bg text-sidebar-foreground overflow-hidden">
      {/* Top Bar */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border bg-toolbar-bg px-4">
        <div className="flex items-center gap-3">
          {!embedMode && (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-sidebar-foreground hover:bg-sidebar-accent">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {!embedMode && <Separator orientation="vertical" className="h-6 bg-sidebar-border" />}
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name || "Logo"} className="h-6 max-w-[120px] object-contain" />
          ) : (
            <Sparkles className="h-5 w-5 text-primary" />
          )}
          <span className="font-display font-semibold text-sm">{brand.name || productName}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={undo} disabled={undoStack.length <= 1} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={redoStack.length === 0} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <Redo2 className="h-4 w-4" />
          </Button>

          {/* Print area boundary toggle */}
          {getCurrentPrintArea() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPrintAreaBoundary(!showPrintAreaBoundary)}
              className={`gap-1.5 text-xs ${showPrintAreaBoundary ? "text-primary" : "text-sidebar-foreground"} hover:bg-sidebar-accent`}
              title={showPrintAreaBoundary ? "Hide print area boundary" : "Show print area boundary"}
            >
              {showPrintAreaBoundary ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              Print Area
            </Button>
          )}
          {/* View switcher — only show available views */}
          {availableViews.length > 1 && (
            <>
              <Separator orientation="vertical" className="h-6 bg-sidebar-border" />
              <div className="flex rounded-lg overflow-hidden border border-sidebar-border">
                {availableViews.map((view) => (
                  <button
                    key={view}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${activeView === view ? "bg-primary text-primary-foreground" : "bg-sidebar-accent hover:bg-sidebar-accent/80"}`}
                    onClick={() => setActiveView(view)}
                  >
                    {VIEW_LABELS[view]}
                  </button>
                ))}
              </div>
            </>
          )}

          <Separator orientation="vertical" className="h-6 bg-sidebar-border" />
          {embedMode ? (
            <>
              <Button size="sm" variant="outline" onClick={handleCancel} className="gap-1.5 border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80">
                Cancel
              </Button>
              <Button size="sm" className="gap-1.5" onClick={exportAndComplete} disabled={exporting}>
                {exporting ? "Exporting..." : "✓ Done"}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80">
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
              <Button size="sm" className="gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar — vertical icon strip + content panel */}
        <div className="flex border-r border-sidebar-border bg-toolbar-bg">
          {/* Vertical icon strip */}
          <div className="flex flex-col border-r border-sidebar-border bg-toolbar-bg">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTool(t.id);
                  if (t.id === "upload") fileInputRef.current?.click();
                }}
                className={`flex flex-col items-center gap-1 px-3 py-3 text-xs transition-colors ${activeTool === t.id ? "bg-sidebar-accent text-primary" : "hover:bg-sidebar-accent/50 text-sidebar-foreground"}`}
              >
                <t.icon className="h-4 w-4" />
                <span className="text-[10px]">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Content panel */}
          <div className="w-64 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Unified Color Picker */}
              {activeTool !== "layers" && activeTool !== "ai" && (
                <div className="space-y-2 border border-sidebar-border rounded-lg p-3 bg-sidebar-accent/30">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {["#000000","#ffffff","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#6366f1","#a855f7","#ec4899","#64748b","#78716c"].map((c) => (
                      <button
                        key={c}
                        onClick={() => updateFillColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${fillColor === c ? "border-primary ring-2 ring-primary/30 scale-110" : "border-border"}`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="color" value={fillColor} onChange={(e) => updateFillColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0" />
                    <Input value={fillColor} onChange={(e) => updateFillColor(e.target.value)} className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground font-mono text-xs" />
                  </div>
                </div>
              )}

              {/* Selected object properties */}
              {selectedObject && selectedPropertiesPanel && activeTool !== "layers" && activeTool !== "ai" && (
                <>
                  {selectedPropertiesPanel}
                  <Separator className="bg-sidebar-border" />
                </>
              )}

              {activeTool === "text" && !selectedObject && (
                  <>
                    <Button onClick={addText} variant="outline" className="w-full gap-2 border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80">
                      <Type className="h-4 w-4" /> Add Custom Text
                    </Button>

                    {/* Text Templates - scrollable */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Templates</label>
                      <div className="grid grid-cols-2 gap-2">
                        {TEXT_TEMPLATES.map((tmpl, i) => (
                          <button
                            key={i}
                            onClick={() => addTextTemplate(tmpl)}
                            className="group relative border border-sidebar-border rounded-lg p-3 hover:border-primary/50 hover:bg-sidebar-accent transition-all text-left overflow-hidden"
                          >
                            <div className="space-y-0.5">
                              {tmpl.lines.map((line, li) => (
                                <p
                                  key={li}
                                  className="truncate leading-tight"
                                  style={{
                                    fontFamily: line.fontFamily,
                                    fontSize: `${Math.min(line.fontSize / 4, 14)}px`,
                                    fontWeight: line.fontWeight || "normal",
                                    fontStyle: line.fontStyle || "normal",
                                    textTransform: line.textTransform as any || "none",
                                    letterSpacing: line.letterSpacing || "normal",
                                    color: "currentColor",
                                  }}
                                >
                                  {line.text}
                                </p>
                              ))}
                            </div>
                            <span className="absolute bottom-1 right-1.5 text-[8px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{tmpl.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
            )}

            {activeTool === "shapes" && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { id: "rect", icon: <Square className="h-6 w-6" />, label: "Rectangle" },
                    { id: "roundedRect", icon: <RectangleHorizontal className="h-6 w-6" />, label: "Rounded" },
                    { id: "circle", icon: <CircleIcon className="h-6 w-6" />, label: "Circle" },
                    { id: "ellipse", icon: <CircleIcon className="h-6 w-6 scale-x-125" />, label: "Ellipse" },
                    { id: "triangle", icon: <TriangleIcon className="h-6 w-6" />, label: "Triangle" },
                    { id: "pentagon", icon: <Pentagon className="h-6 w-6" />, label: "Pentagon" },
                    { id: "hexagon", icon: <Hexagon className="h-6 w-6" />, label: "Hexagon" },
                    { id: "star", icon: <Star className="h-6 w-6" />, label: "Star" },
                    { id: "arrow", icon: <ArrowRight className="h-6 w-6" />, label: "Arrow" },
                    { id: "line", icon: <Minus className="h-6 w-6" />, label: "Line" },
                    { id: "cross", icon: <span className="text-lg font-bold">✚</span>, label: "Cross" },
                  ] as const).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => addShape(s.id)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border border-sidebar-border hover:bg-sidebar-accent hover:border-primary/50 transition-colors"
                      title={s.label}
                    >
                      {s.icon}
                      <span className="text-[9px] text-muted-foreground">{s.label}</span>
                    </button>
                  ))}
                </div>
                <Separator className="bg-sidebar-border" />
                <label className="text-xs font-medium text-muted-foreground">Patterns</label>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { id: "stripes", label: "Stripes", preview: "╱╱" },
                    { id: "dots", label: "Dots", preview: "•••" },
                    { id: "grid", label: "Grid", preview: "▦" },
                    { id: "checkerboard", label: "Checker", preview: "▚" },
                    { id: "zigzag", label: "Zigzag", preview: "⩘" },
                    { id: "crosshatch", label: "Cross", preview: "╳" },
                    { id: "horizontal", label: "H-Lines", preview: "☰" },
                    { id: "vertical", label: "V-Lines", preview: "┃┃" },
                  ] as const).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addPattern(p.id)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border border-sidebar-border hover:bg-sidebar-accent hover:border-primary/50 transition-colors"
                      title={p.label}
                    >
                      <span className="text-lg leading-none">{p.preview}</span>
                      <span className="text-[9px] text-muted-foreground">{p.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeTool === "upload" && (
              <>
                <div className="text-center py-8">
                  <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">Upload an image to place on your design</p>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Submit files in PNG or JPEG format.<br />
                    12″ × 16″ / 30.48 × 40.64 cm / 1500 × 3000 px / at least 150 DPI
                  </p>
                  <Button onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Choose File</Button>
                </div>
              </>
            )}

            {activeTool === "clipart" && (
              <>
                <div className="flex gap-1 flex-wrap">
                  {Object.keys(CLIPART_CATEGORIES).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setClipartCategory(cat)}
                      className={`px-2.5 py-1 text-xs rounded-full transition-colors ${clipartCategory === cat ? "bg-primary text-primary-foreground" : "bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {CLIPART_CATEGORIES[clipartCategory as keyof typeof CLIPART_CATEGORIES]?.map((item) => (
                    <button
                      key={item.name}
                      onClick={() => addClipart(item)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg border border-sidebar-border hover:bg-sidebar-accent hover:border-primary/50 transition-colors"
                      title={item.name}
                    >
                      <item.icon className="h-6 w-6" style={{ color: fillColor }} />
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center">{item.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
              {/* AI Assistant Tab */}
              {activeTool === "ai" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {isEditMode ? "Describe changes to your design" : "Describe your design"}
                    </label>
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generateAiDesign(); } }}
                      placeholder={isEditMode ? "e.g. Make it blue, add a border..." : "e.g. A cool dragon breathing fire..."}
                      className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs min-h-[80px] resize-none"
                      disabled={aiGenerating}
                    />
                    <Button
                      onClick={() => generateAiDesign(false)}
                      disabled={aiGenerating || !aiPrompt.trim()}
                      className="w-full gap-2"
                    >
                      <Wand2 className="h-4 w-4" />
                      {aiGenerating ? (isEditMode ? "Editing..." : "Generating...") : (isEditMode ? "Edit Design" : "Generate Design")}
                    </Button>
                    {isEditMode && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => generateAiDesign(true)}
                        disabled={aiGenerating || !aiPrompt.trim()}
                        className="w-full text-xs text-muted-foreground"
                      >
                        Generate New Instead
                      </Button>
                    )}
                  </div>

                  {!isEditMode && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Style Preset</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "None", value: "" },
                          { label: "Vintage", value: "Vintage retro distressed" },
                          { label: "Minimalist", value: "Clean minimalist simple" },
                          { label: "Graffiti", value: "Urban graffiti street art spray paint" },
                          { label: "Watercolor", value: "Soft watercolor painting" },
                          { label: "Neon", value: "Bright neon glowing" },
                          { label: "Tattoo", value: "Traditional tattoo ink illustration" },
                          { label: "Pixel Art", value: "Retro pixel art 8-bit" },
                          { label: "Japanese", value: "Japanese ukiyo-e woodblock print" },
                          { label: "Pop Art", value: "Bold pop art comic book" },
                          { label: "Botanical", value: "Detailed botanical illustration" },
                        ].map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => setAiStyle(preset.value)}
                            className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                              aiStyle === preset.value
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-sidebar-border text-muted-foreground hover:border-primary/40 hover:bg-sidebar-accent"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isEditMode && (
                    <Button
                      variant="outline"
                      onClick={removeBackground}
                      disabled={removingBg}
                      className="w-full gap-2 border-sidebar-border"
                    >
                      <Eraser className="h-4 w-4" />
                      {removingBg ? "Removing Background..." : "Remove Background"}
                    </Button>
                  )}

                  {aiGenerating && (
                    <div className="flex items-center justify-center py-6">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-xs text-muted-foreground">Creating your design...</p>
                      </div>
                    </div>
                  )}

                  {aiHistory.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Generations</label>
                      <div className="grid grid-cols-2 gap-2">
                        {aiHistory.map((item, i) => (
                          <button
                            key={i}
                            onClick={() => addAiImageToCanvas(item.imageUrl)}
                            className="group relative border border-sidebar-border rounded-lg overflow-hidden hover:border-primary/50 transition-all"
                            title={`Re-add: ${item.prompt}`}
                          >
                            <img src={item.imageUrl} alt={item.prompt} className="w-full aspect-square object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[9px] text-white truncate">{item.prompt}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prompt Ideas</label>
                    <div className="space-y-1">
                      {[
                        "A vintage-style logo with an eagle",
                        "Abstract geometric pattern in blue and gold",
                        "Floral wreath with roses",
                        "Retro sunset with palm trees",
                        "Minimalist mountain landscape",
                      ].map((idea) => (
                        <button
                          key={idea}
                          onClick={() => setAiPrompt(idea)}
                          className="w-full text-left text-xs px-2.5 py-1.5 rounded-md border border-sidebar-border hover:bg-sidebar-accent hover:border-primary/30 transition-colors text-muted-foreground hover:text-sidebar-foreground"
                        >
                          {idea}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Layers Tab */}
              {activeTool === "layers" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <LayersIcon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Layers</span>
                    <span className="ml-auto text-xs text-muted-foreground">{layers.length}</span>
                  </div>
                  {layers.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No layers yet. Add text, shapes, or images to get started.
                    </div>
                  ) : (
                    <div className="divide-y divide-sidebar-border border border-sidebar-border rounded-lg overflow-hidden">
                      {layers.map((layer, i) => (
                        <div
                          key={layer.id}
                          className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer ${
                            selectedObject === layer.obj ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
                          }`}
                          onClick={() => {
                            fabricRef.current?.setActiveObject(layer.obj);
                            fabricRef.current?.renderAll();
                          }}
                        >
                          <Palette className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate flex-1">{layer.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.obj); }} className="hover:text-primary">
                            {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); toggleLock(layer.obj); }} className="hover:text-primary">
                            {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); duplicateLayer(layer.obj); }} className="hover:text-primary" title="Duplicate">
                            <Copy className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.obj); }} className="hover:text-destructive" title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); moveLayer(i, "up"); }} className="hover:text-primary">
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); moveLayer(i, "down"); }} className="hover:text-primary">
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col bg-editor-bg overflow-hidden p-4">
          <div className="relative flex-1 rounded-lg border border-sidebar-border shadow-2xl overflow-hidden bg-background">
            {bgImageUrl && (
              <img
                src={bgImageUrl}
                alt={`${productName} ${VIEW_LABELS[activeView]} view`}
                className="absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />
            )}
            <div ref={containerRef} className="absolute inset-0 z-10">
              <canvas ref={canvasRef} />
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            {VIEW_LABELS[activeView]} View{selectedVariant ? ` • ${selectedVariant.colorName}` : ""}
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </div>
  );
}

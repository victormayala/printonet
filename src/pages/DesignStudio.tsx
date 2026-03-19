import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricText, Rect, Circle, Triangle, FabricImage } from "fabric";
import { getProductById, type Product, type ProductVariant } from "@/data/products";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, ArrowLeft, Type, Square, CircleIcon, TriangleIcon,
  Upload, Undo2, Redo2, Trash2, Eye, EyeOff, Lock, Unlock,
  ChevronUp, ChevronDown, Layers as LayersIcon, Palette, Save,
  ShoppingCart, ImageIcon, Sticker,
  Heart, Star, Flame, Zap, Music, Sun, Moon, Cloud,
  Coffee, Camera, Anchor, Award, Bell, Bookmark, Crown,
  Diamond, Flag, Gift, Globe, Key, Leaf, Mountain,
  Rocket, Shield, Smile, Snowflake, Target, Umbrella, Wifi,
} from "lucide-react";
import ReactDOMServer from "react-dom/server";
import React from "react";

const CLIPART_CATEGORIES = {
  "Popular": [
    { name: "Heart", icon: Heart },
    { name: "Star", icon: Star },
    { name: "Smile", icon: Smile },
    { name: "Crown", icon: Crown },
    { name: "Diamond", icon: Diamond },
    { name: "Flame", icon: Flame },
    { name: "Zap", icon: Zap },
    { name: "Rocket", icon: Rocket },
  ],
  "Nature": [
    { name: "Sun", icon: Sun },
    { name: "Moon", icon: Moon },
    { name: "Cloud", icon: Cloud },
    { name: "Leaf", icon: Leaf },
    { name: "Mountain", icon: Mountain },
    { name: "Snowflake", icon: Snowflake },
    { name: "Umbrella", icon: Umbrella },
  ],
  "Objects": [
    { name: "Coffee", icon: Coffee },
    { name: "Camera", icon: Camera },
    { name: "Anchor", icon: Anchor },
    { name: "Award", icon: Award },
    { name: "Bell", icon: Bell },
    { name: "Bookmark", icon: Bookmark },
    { name: "Flag", icon: Flag },
    { name: "Gift", icon: Gift },
    { name: "Globe", icon: Globe },
    { name: "Key", icon: Key },
    { name: "Shield", icon: Shield },
    { name: "Target", icon: Target },
    { name: "Music", icon: Music },
    { name: "Wifi", icon: Wifi },
  ],
};

type ViewSide = "front" | "back" | "side1" | "side2";

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
}

const VIEW_LABELS: Record<ViewSide, string> = {
  front: "Front",
  back: "Back",
  side1: "Side 1",
  side2: "Side 2",
};

export default function DesignStudio() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const isInventoryProduct = productId?.startsWith("inv-");
  const staticProduct = !isInventoryProduct ? getProductById(productId || "") : null;

  const [invProduct, setInvProduct] = useState<InventoryProduct | null>(null);
  const [loading, setLoading] = useState(isInventoryProduct);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTool, setActiveTool] = useState<string>("select");
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
  // Load inventory product
  useEffect(() => {
    if (!isInventoryProduct || !productId) return;
    const dbId = productId.replace("inv-", "");
    supabase
      .from("inventory_products")
      .select("*")
      .eq("id", dbId)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setInvProduct(data as InventoryProduct);
          const views: ViewSide[] = [];
          if (data.image_front) views.push("front");
          if (data.image_back) views.push("back");
          if (data.image_side1) views.push("side1");
          if (data.image_side2) views.push("side2");
          if (views.length === 0) views.push("front");
          setAvailableViews(views);
          setActiveView(views[0]);
        }
        setLoading(false);
      });
  }, [productId, isInventoryProduct]);

  // Set up static product
  useEffect(() => {
    if (staticProduct) {
      setSelectedVariant(staticProduct.variants[0]);
      const views: ViewSide[] = ["front"];
      if (staticProduct.hasFrontBack) views.push("back");
      setAvailableViews(views);
    }
  }, [staticProduct]);

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

  // Initialize canvas with responsive sizing
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    if (fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }

    const container = containerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

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
    canvas.on("object:modified", () => { saveState(); updateLayers(); });
    canvas.on("object:added", () => updateLayers());
    canvas.on("object:removed", () => updateLayers());

    saveState();
    setCanvasReady(true);

    // Resize observer to keep canvas responsive
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && fabricRef.current) {
          fabricRef.current.setDimensions({ width, height });
          fabricRef.current.renderAll();
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      canvas.dispose();
      fabricRef.current = null;
      setCanvasReady(false);
    };
  }, []);

  // Keep the Fabric canvas transparent for inventory products so the product mockup
  // can render reliably as a layer behind it.
  useEffect(() => {
    if (!canvasReady || !fabricRef.current) return;
    const canvas = fabricRef.current;
    const hasInventoryBackground = Boolean(getCurrentImageUrl());

    canvas.backgroundImage = undefined;
    canvas.backgroundColor = hasInventoryBackground ? "rgba(0,0,0,0)" : selectedVariant?.hex || "#ffffff";
    canvas.renderAll();
  }, [activeView, invProduct, selectedVariant, canvasReady]);

  function handleSelection(e: any) {
    const obj = e.selected?.[0];
    if (obj) {
      setSelectedObject(obj);
      setObjectProps({
        opacity: Math.round((obj.opacity || 1) * 100),
        fill: typeof obj.fill === "string" ? obj.fill : "#000000",
      });
    }
  }

  function updateLayers() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects().map((obj: any, i: number) => ({
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
    if (!canvas) return;
    const json = JSON.stringify(canvas.toJSON());
    setUndoStack((prev) => [...prev, json]);
    setRedoStack([]);
  }

  function undo() {
    const canvas = fabricRef.current;
    if (!canvas || undoStack.length <= 1) return;
    const newUndo = [...undoStack];
    const current = newUndo.pop()!;
    setRedoStack((prev) => [...prev, current]);
    const prev = newUndo[newUndo.length - 1];
    setUndoStack(newUndo);
    canvas.loadFromJSON(prev).then(() => { canvas.renderAll(); updateLayers(); });
  }

  function redo() {
    const canvas = fabricRef.current;
    if (!canvas || redoStack.length === 0) return;
    const newRedo = [...redoStack];
    const next = newRedo.pop()!;
    setRedoStack(newRedo);
    setUndoStack((prev) => [...prev, next]);
    canvas.loadFromJSON(next).then(() => { canvas.renderAll(); updateLayers(); });
  }

  function addText() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const text = new FabricText(textInput, {
      left: 150, top: 250, fontSize, fill: fillColor, fontFamily: "Inter",
    });
    (text as any).customName = `Text: "${textInput.slice(0, 12)}"`;
    canvas.add(text);
    canvas.setActiveObject(text);
    saveState();
  }

  function addShape(shape: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    let obj: any;
    const commonProps = { left: 180, top: 220, fill: fillColor };
    switch (shape) {
      case "rect":
        obj = new Rect({ ...commonProps, width: 120, height: 100, rx: 8, ry: 8 });
        (obj as any).customName = "Rectangle";
        break;
      case "circle":
        obj = new Circle({ ...commonProps, radius: 60 });
        (obj as any).customName = "Circle";
        break;
      case "triangle":
        obj = new Triangle({ ...commonProps, width: 120, height: 100 });
        (obj as any).customName = "Triangle";
        break;
      default: return;
    }
    canvas.add(obj);
    canvas.setActiveObject(obj);
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
        const img = new FabricImage(imgEl, {
          left: 100, top: 100,
          scaleX: Math.min(300 / imgEl.width, 1),
          scaleY: Math.min(300 / imgEl.height, 1),
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
      selectedObject.set("fill", value);
      setObjectProps((p) => ({ ...p, fill: value }));
    }
    fabricRef.current?.renderAll();
    saveState();
  }

  // Determine product info
  const productName = invProduct?.name || staticProduct?.name || "Product";
  const productIcon = staticProduct?.icon;
  const productVariants = staticProduct?.variants || [];
  const bgImageUrl = getCurrentImageUrl();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-editor-bg text-sidebar-foreground">
        <p>Loading product...</p>
      </div>
    );
  }

  if (!staticProduct && !invProduct) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold">Product not found</h2>
          <Link to="/products" className="mt-4 inline-block">
            <Button variant="outline">← Back to products</Button>
          </Link>
        </div>
      </div>
    );
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
      const img = new FabricImage(imgEl, {
        left: 150, top: 200,
        scaleX: 1, scaleY: 1,
      });
      (img as any).customName = `Clipart: ${clipartItem.name}`;
      canvas.add(img);
      canvas.setActiveObject(img);
      saveState();
      URL.revokeObjectURL(url);
    };
    imgEl.src = url;
  }

  const tools = [
    { id: "select", icon: ImageIcon, label: "Select" },
    { id: "text", icon: Type, label: "Text" },
    { id: "shapes", icon: Square, label: "Shapes" },
    { id: "clipart", icon: Sticker, label: "Clipart" },
    { id: "upload", icon: Upload, label: "Upload" },
  ];

  return (
    <div className="flex h-screen flex-col bg-editor-bg text-sidebar-foreground overflow-hidden">
      {/* Top Bar */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border bg-toolbar-bg px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Separator orientation="vertical" className="h-6 bg-sidebar-border" />
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-display font-semibold text-sm">{productName}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={undo} disabled={undoStack.length <= 1} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={redoStack.length === 0} className="text-sidebar-foreground hover:bg-sidebar-accent">
            <Redo2 className="h-4 w-4" />
          </Button>

          {/* Variant color switcher (static products only) */}
          {productVariants.length > 0 && (
            <>
              <Separator orientation="vertical" className="h-6 bg-sidebar-border" />
              <div className="flex gap-1.5 items-center">
                {productVariants.map((v) => (
                  <button
                    key={v.color}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${selectedVariant?.color === v.color ? "border-primary scale-110" : "border-sidebar-border"}`}
                    style={{ backgroundColor: v.hex }}
                    onClick={() => setSelectedVariant(v)}
                    title={v.colorName}
                  />
                ))}
              </div>
            </>
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
          <Button size="sm" variant="outline" className="gap-1.5 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent">
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
          <Button size="sm" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <div className="flex w-72 flex-col border-r border-sidebar-border bg-toolbar-bg">
          <div className="flex border-b border-sidebar-border">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTool(t.id);
                  if (t.id === "upload") fileInputRef.current?.click();
                }}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${activeTool === t.id ? "bg-sidebar-accent text-primary" : "hover:bg-sidebar-accent/50 text-sidebar-foreground"}`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTool === "text" && (
              <>
                {/* Text Templates */}
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

                <Separator className="bg-sidebar-border" />

                {/* Custom Text */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Text</label>
                  <Input value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Enter text..." className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Font Size: {fontSize}px</label>
                  <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={12} max={120} step={1} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                    <Input value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground font-mono text-xs" />
                  </div>
                </div>
                <Button onClick={addText} className="w-full gap-2"><Type className="h-4 w-4" /> Add Text</Button>
              </>
            )}

            {activeTool === "shapes" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Fill Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                    <Input value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground font-mono text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" onClick={() => addShape("rect")} className="flex-col gap-1 h-auto py-3 border-sidebar-border hover:bg-sidebar-accent">
                    <Square className="h-5 w-5" /><span className="text-[10px]">Rectangle</span>
                  </Button>
                  <Button variant="outline" onClick={() => addShape("circle")} className="flex-col gap-1 h-auto py-3 border-sidebar-border hover:bg-sidebar-accent">
                    <CircleIcon className="h-5 w-5" /><span className="text-[10px]">Circle</span>
                  </Button>
                  <Button variant="outline" onClick={() => addShape("triangle")} className="flex-col gap-1 h-auto py-3 border-sidebar-border hover:bg-sidebar-accent">
                    <TriangleIcon className="h-5 w-5" /><span className="text-[10px]">Triangle</span>
                  </Button>
                </div>
              </>
            )}

            {activeTool === "select" && selectedObject && (
              <>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Properties</h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Opacity: {objectProps.opacity}%</label>
                    <Slider value={[objectProps.opacity]} onValueChange={([v]) => updateSelectedProp("opacity", v)} min={0} max={100} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Fill</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={objectProps.fill} onChange={(e) => updateSelectedProp("fill", e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                      <Input value={objectProps.fill} onChange={(e) => updateSelectedProp("fill", e.target.value)} className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground font-mono text-xs" />
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" onClick={deleteSelected} className="w-full gap-2">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </>
            )}

            {activeTool === "select" && !selectedObject && (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click an object on the canvas to edit its properties</p>
              </div>
            )}

            {activeTool === "upload" && (
              <div className="text-center py-8">
                <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">Upload an image to place on your design</p>
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Choose File</Button>
              </div>
            )}

            {activeTool === "clipart" && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                    <Input value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="bg-sidebar-accent border-sidebar-border text-sidebar-foreground font-mono text-xs" />
                  </div>
                </div>
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
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col bg-editor-bg overflow-hidden p-4">
          <div ref={containerRef} className="relative flex-1 rounded-lg border border-sidebar-border shadow-2xl overflow-hidden bg-background">
            {bgImageUrl ? (
              <img
                src={bgImageUrl}
                alt={`${productName} ${VIEW_LABELS[activeView]} view`}
                className="absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />
            ) : productIcon ? (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50 text-[10rem]">
                {productIcon}
              </div>
            ) : null}
            <canvas ref={canvasRef} className="absolute inset-0 z-10" />
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            {VIEW_LABELS[activeView]} View{selectedVariant ? ` • ${selectedVariant.colorName}` : ""}
          </div>
        </div>

        {/* Right Panel — Layers */}
        <div className="w-64 border-l border-sidebar-border bg-toolbar-bg flex flex-col">
          <div className="flex items-center gap-2 p-4 border-b border-sidebar-border">
            <LayersIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Layers</span>
            <span className="ml-auto text-xs text-muted-foreground">{layers.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {layers.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No layers yet. Add text, shapes, or images to get started.
              </div>
            ) : (
              <div className="divide-y divide-sidebar-border">
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
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
    </div>
  );
}

import {
  ArrowLeft,
  Bold,
  Camera,
  Clapperboard,
  Heading2,
  ImagePlus,
  Italic,
  List,
  Send,
  Sparkles,
  Video,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { inputBase } from "@/components/flow/Fields"
import { Jimbot } from "@/components/mascot/Jimbot"
import { Button } from "@/components/ui/Button"
import { Segmented } from "@/components/ui/Segmented"
import { Toggle } from "@/components/ui/Toggle"
import { cn } from "@/lib/cn"
import { getForcedState, isBizPreview } from "@/lib/forced"
import { shrink } from "@/screens/personalize/TravelerThemes"
import type { Post, PostType } from "../seed"
import { useBiz } from "../store"
import { Card, PageHeader, StateBlock } from "../ui"
import { createPost, updatePost } from "../db/posts"
import { uploadBusinessAsset } from "../db/assets"
import { BusinessAssetImage } from "../ui/BusinessAssetImage"
import { postWriteValues, type EditablePostStatus } from "../db/ownerPersistence"

const field = cn(inputBase, "border-line")

export function Composer() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { d, setLocal, t, showToast } = useBiz()
  const navigate = useNavigate()
  const existing = d.posts.find((p) => p.id === id)
  const [type, setType] = useState<PostType>(
    existing?.type ?? (params.get("type") as PostType || "post"),
  )
  const [text, setText] = useState(existing?.text ?? "")
  const [title, setTitle] = useState(existing?.title ?? "")
  const [media, setMedia] = useState<string[]>(existing?.media ?? [])
  const [video, setVideo] = useState<string | undefined>(existing?.video)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [duration, setDuration] = useState(0)
  const [trim, setTrim] = useState<[number, number]>([0, 0])
  const [capEn, setCapEn] = useState(true)
  const [capTl, setCapTl] = useState(true)
  const [helper, setHelper] = useState(false)
  const editor = useRef<HTMLDivElement>(null)
  const perm = getForcedState() === "permission"

  useEffect(() => {
    if (type === "blog" && editor.current && !editor.current.innerHTML)
      editor.current.innerHTML =
        existing?.type === "blog" ? `<p>${existing.text}</p>` : ""
  }, [type, existing])
  useEffect(
    () => () => {
      if (video?.startsWith("blob:")) URL.revokeObjectURL(video)
    },
    [video],
  )

  const ideas = {
    post: [
      t(
        "Bagong luto, bagong saya! Subukan ang kare-kare namin ngayong tanghalian.",
        "Freshly cooked, freshly happy! Try our kare-kare this lunch.",
      ),
      t(
        "Ubos-biyaya Biyernes: Buy 1 Take 1 sa Tapsilog, 5 PM hanggang 8 PM lang.",
        "Friday treat: Buy 1 Take 1 Tapsilog, 5 PM to 8 PM only.",
      ),
      t(
        "Salamat sa 25 taon, Ermita! Kain tayo.",
        "Thank you for 25 years, Ermita! Let’s eat.",
      ),
    ],
    templates: [
      [
        t("Promo", "Promo"),
        t(
          "PROMO: [item] sa ₱[presyo] lang, [araw] mula [oras]. Tara na!",
          "PROMO: [item] for only ₱[price], [day] from [time]. See you!",
        ),
      ],
      [
        t("Bagong item", "New item"),
        t(
          "BAGO sa menu: [item]! [isang linya tungkol sa lasa].",
          "NEW on the menu: [item]! [one line about the taste].",
        ),
      ],
      [
        t("Behind the scenes", "Behind the scenes"),
        t(
          "Silipin kung paano namin niluluto ang [item] tuwing umaga.",
          "See how we cook [item] every morning.",
        ),
      ],
    ],
    script: t(
      '0–3s: Close-up ng kumukulong kare-kare. 3–8s: Inilalagay ng chef ang bagoong. 8–12s: Ihain sa mesa. Huling text: "Business, Ermita".',
      '0–3s: Close-up of bubbling kare-kare. 3–8s: The chef adds bagoong. 8–12s: Serve at the table. End card: "Business, Ermita".',
    ),
  }

  const save = async (status: EditablePostStatus) => {
    setSaving(true)
    const body = type === "blog" ? (editor.current?.innerText ?? "") : text
    try {
      let savedMedia = media
      let savedVideo = video
      if (!isBizPreview() && d.business.id) {
        // I-upload muna ang temporary selection at database Storage path lang ang ilagay sa post.
        savedMedia = await Promise.all(
          media.map(async (source) => {
            if (!source.startsWith("data:") && !source.startsWith("blob:"))
              return source
            const response = await fetch(source)
            if (!response.ok)
              throw new Error("Could not read the selected post image.")
            return uploadBusinessAsset(
              d.business.id!,
              await response.blob(),
              "image",
            )
          }),
        )
        if (videoFile)
          savedVideo = await uploadBusinessAsset(
            d.business.id,
            videoFile,
            "video",
          )
        else if (savedVideo?.startsWith("blob:"))
          throw new Error("Please select the video again before publishing.")
      }

      const post: Post = {
        id: existing?.id ?? `p${Date.now()}`,
        type,
        title: type === "blog" ? title : undefined,
        text: body,
        media: savedMedia,
        video: savedVideo,
        status,
        at: status === "published" ? new Date().toISOString() : existing?.at ?? new Date().toISOString(),
        views: existing?.views ?? 0,
        likes: existing?.likes ?? 0,
        saves: existing?.saves ?? 0,
        comments: existing?.comments ?? 0,
      }

      if (!isBizPreview()) {
        if (!d.business.id)
          throw new Error("Save the business profile before saving posts.")
        const values = postWriteValues(post, status)
        const saved = existing?.id.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        )
          ? await updatePost(d.business.id, existing.id, values)
          : await createPost(d.business.id, values)
        if (saved.error || !saved.data)
          throw new Error(saved.error ?? "The post could not be saved.")
        post.id = saved.data.id
      }

      await setLocal((x) => ({
        ...x,
        posts: existing
          ? x.posts.map((p) => (p.id === existing.id ? post : p))
          : [post, ...x.posts],
      }))
      showToast({
        text:
          status === "draft"
            ? t("Na-save bilang draft", "Saved as draft")
          : t("Na-publish sa profile mo!", "Published to your profile!"),
        expression: status === "published" ? "celebrating" : "pointing",
      })
      navigate(`/biz/content?v=${status}`)
    } catch (error) {
      showToast({
        text:
          error instanceof Error
            ? error.message
            : t("Hindi na-save ang post.", "Could not save the post."),
        expression: "unsure",
      })
    } finally {
      setSaving(false)
    }
  }
  const canPublish =
    type === "blog"
      ? title.trim().length > 2
      : type === "reel"
        ? !!video || !!existing
        : text.trim().length > 2 || media.length > 0
  const typeLabel = { post: "Post", reel: "Reel", blog: "Blog" }

  const helperPanel = (
    <Card
      title={t("Tulungan akong sumulat", "Help me write")}
      icon={<Sparkles size={20} />}
    >
      <div className="flex items-end gap-2">
        <Jimbot
          expression="idea"
          variant="standalone"
          size={60}
          className="-mb-1"
        />
        <p className="mb-2 flex-1 rounded-[16px] rounded-bl-md bg-sunken px-3 py-2 text-[15px] dark:bg-elevated">
          {t(
            "Pumili ng ideya at i-edit mo.",
            "Pick an idea, then make it yours.",
          )}
        </p>
      </div>
      <p className="mb-1.5 mt-3 font-display text-[14px] font-medium">
        {t("Mga ideya sa caption", "Caption ideas")}
      </p>
      <ul className="space-y-2">
        {ideas.post.map((i) => (
          <li key={i}>
            <button
              onClick={() =>
                type === "blog"
                  ? editor.current &&
                    (editor.current.innerHTML += `<p>${i}</p>`)
                  : setText(i)
              }
              className="w-full rounded-[14px] border border-line p-3 text-left text-[15px] hover:border-primary"
            >
              {i}
            </button>
          </li>
        ))}
      </ul>
      <p className="mb-1.5 mt-4 font-display text-[14px] font-medium">
        Templates
      </p>
      <div className="flex flex-wrap gap-2">
        {ideas.templates.map(([n, v]) => (
          <button
            key={n}
            onClick={() => setText(v)}
            className="min-h-11 rounded-full bg-sunken px-4 font-display text-[14px] font-medium dark:bg-elevated"
          >
            {n}
          </button>
        ))}
      </div>
      {type === "reel" && (
        <>
          <p className="mb-1.5 mt-4 font-display text-[14px] font-medium">
            {t("Maikling script ng video", "Short video script")}
          </p>
          <p className="rounded-[14px] bg-sunken p-3 text-[15px] dark:bg-elevated">
            {ideas.script}
          </p>
        </>
      )}
    </Card>
  )

  const preview = (
    <Card
      title={t("Preview ng post", "Post preview")}
      sub={t("Ang laman lang ng post mo", "Your post content only")}
    >
      <div className="overflow-hidden rounded-[18px] border border-line">
        {type === "reel" ? (
          <div className="mx-auto aspect-[9/16] max-h-[420px] bg-black">
            {video ? (
              <video
                src={video}
                className="h-full w-full object-cover"
                controls
                playsInline
                muted
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[15px] text-white/70">
                {t("Wala pang video", "No video yet")}
              </div>
            )}
          </div>
        ) : (
          (type === "blog" ? media[0] : media[0]) && (
            <BusinessAssetImage
              src={media[0]}
              alt=""
              className="aspect-[4/3] w-full object-cover"
            />
          )
        )}
        <div className="p-3">
          {type === "blog" && (
            <p className="font-display text-[18px] font-semibold">
              {title || t("Pamagat", "Title")}
            </p>
          )}
          <p className="whitespace-pre-wrap text-[15px]">
            {type === "blog"
              ? t(
                  "(Makikita ang buong teksto sa profile)",
                  "(Full text appears on your profile)",
                )
              : text || t("Isulat ang caption…", "Write a caption…")}
          </p>
          {media.length > 1 && type === "post" && (
            <p className="mt-1 text-[13px] text-fg-2">
              +{media.length - 1} {t("larawan", "photos")}
            </p>
          )}
        </div>
      </div>
    </Card>
  )

  return (
    <main>
      <div className="px-4 pt-4 md:px-8">
        <Button
          variant="ghost"
          icon={<ArrowLeft size={18} />}
          onClick={() => navigate("/biz/content")}
        >
          {t("Bumalik sa Posts", "Back to Posts")}
        </Button>
      </div>
      <PageHeader
        className="pt-1 md:pt-2"
        title={
          existing
            ? t(`I-edit ang ${typeLabel[type]}`, `Edit ${typeLabel[type]}`)
            : type === "reel"
              ? t("Gumawa ng Reel", "Create a Reel")
              : type === "blog"
                ? t("Sumulat ng blog", "Write a blog post")
                : t("Bagong post", "New post")
        }
      />
      <div className="grid gap-4 px-4 md:px-8 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          {!existing && (
            <Segmented<PostType>
              label={t("Uri ng post", "Post type")}
              value={type}
              onChange={setType}
              options={[
                { value: "post", label: "Post" },
                { value: "reel", label: "Reel" },
                { value: "blog", label: "Blog" },
              ]}
            />
          )}
          <Card>
            <div className="space-y-4">
              {type === "reel" &&
                (perm ? (
                  <StateBlock
                    className="py-4"
                    pose="camera"
                    placeholder
                    title={t(
                      "Kailangan ng pahintulot sa camera",
                      "Camera permission needed",
                    )}
                    body={t(
                      "Payagan ang camera sa settings ng browser para mag-record, o mag-upload ng video.",
                      "Allow the camera in your browser settings to record, or upload a video instead.",
                    )}
                  />
                ) : (
                  <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                    <div className="mx-auto aspect-[9/16] w-[200px] overflow-hidden rounded-[18px] bg-black">
                      {video ? (
                        <video
                          src={video}
                          className="h-full w-full object-cover"
                          playsInline
                          muted
                          autoPlay
                          loop
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-white/80">
                          <Video size={30} />
                          <span className="text-[14px]">
                            {t(
                              "Patayong video, hanggang 60 segundo",
                              "Vertical video, up to 60 seconds",
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 font-display text-[15px] font-medium text-on-primary">
                          <Clapperboard size={18} /> {t("Mag-upload", "Upload")}
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setVideoFile(file)
                                setVideo(URL.createObjectURL(file))
                              }
                            }}
                          />
                        </label>
                        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-sunken px-5 font-display text-[15px] font-medium dark:bg-elevated">
                          <Camera size={18} /> {t("Mag-record", "Record")}
                          <input
                            type="file"
                            accept="video/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                setVideoFile(file)
                                setVideo(URL.createObjectURL(file))
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              {type === "blog" && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block font-display text-[14px] font-medium">
                      {t("Pamagat", "Title")}
                    </span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={cn(field, "text-[18px] font-semibold")}
                    />
                  </label>
                  <div>
                    <span className="mb-1.5 block font-display text-[14px] font-medium">
                      {t("Laman", "Body")}
                    </span>
                    <div className="overflow-hidden rounded-[16px] border border-line">
                      <div
                        className="flex gap-1 border-b border-line bg-sunken p-1.5 dark:bg-elevated"
                        role="toolbar"
                        aria-label={t("Format", "Formatting")}
                      >
                        {[
                          ["bold", <Bold size={18} key="b" />, "Bold"],
                          ["italic", <Italic size={18} key="i" />, "Italic"],
                          ["h2", <Heading2 size={18} key="h" />, "Heading"],
                          ["list", <List size={18} key="l" />, "List"],
                        ].map(([cmd, ic, l]) => (
                          <button
                            key={cmd as string}
                            type="button"
                            aria-label={l as string}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() =>
                              cmd === "h2"
                                ? document.execCommand(
                                    "formatBlock",
                                    false,
                                    "h2",
                                  )
                                : cmd === "list"
                                  ? document.execCommand("insertUnorderedList")
                                  : document.execCommand(cmd as string)
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-[10px] hover:bg-surface"
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                      <div
                        ref={editor}
                        contentEditable
                        role="textbox"
                        aria-multiline
                        aria-label={t("Laman ng blog", "Blog body")}
                        className="prose-sm min-h-[220px] p-4 text-[16px] leading-relaxed outline-none [&_h2]:font-display [&_h2]:text-[20px] [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6"
                        suppressContentEditableWarning
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
          <div className="flex flex-wrap justify-end gap-2 pb-4">
            <Button
              variant="secondary"
              size="lg"
              disabled={saving}
              onClick={() => void save("draft")}
            >
              {t("I-save bilang draft", "Save draft")}
            </Button>
            <Button
              size="lg"
              icon={<Send size={18} />}
              disabled={!canPublish || saving}
              onClick={() => void save("published")}
            >
              {t("I-publish", "Publish")}
            </Button>
          </div>
        </div>
        <aside className="hidden space-y-4 xl:block">
          {preview}
          {helperPanel}
        </aside>
        <div className="space-y-4 xl:hidden">
          {helper && helperPanel}
          {preview}
        </div>
      </div>
    </main>
  )
}

export default function BackgroundVideo() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="h-full w-full object-cover"
      >
        <source src="/videos/ai-bg2.mp4" type="video/mp4" />
      </video>
    </div>
  )
}

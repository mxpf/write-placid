const documentIds: Record<string, string> = {
  "content/pages/about.md": "15w7JyWtXt0YHKSa6QWTP9cKRE-qW6HWWTnEbKRQEsfQ",
  "content/pages/links.md": "1qnDRP7oYG5nHLI4qnRjysr_-rsayUbmGD2qmhZR_SXA",
  "content/posts/the-silent-type.md": "167Cj207JTzSOlRV341wWTX3h4O-i38YcfDHz9_o6d-o",
  "content/posts/caught-in-a-web.md": "1TjHi4PPQOhJ68n-O6kdFifJmZWOv36LiJ4fLJL0H8Ko",
  "content/posts/remain-stranger.md": "1OKz85gruIFVPvKF0-YYby5AnBNqhng8NcLRRT8Yyo-4",
  "content/posts/questioning-the-floorboards.md": "1pzke5QFS4Jbbo9Hk8eD0MXrUMdPf7Iq-7e5azIbhKTs",
  "content/posts/the-message-wants-a-body.md": "1Vi57qNXIUwU1PJRV2n1wlCKg1jmGi_-zttrBhfWwEig",
  "content/posts/what-is-connected-to-what.md": "1MMO4TRYM5j2NLBxAVmoT_ir4xTYsXtU9ioafZfm0K1M",
  "content/posts/a-system-for-looking.md": "1bKdWbC1hMUpMbgFUO-dT43nZno8JcyPCkVj7DFC0YZ8",
  "content/posts/strange-enough-to-notice.md": "1vDGfGG_gQal4HkELtA-c2PbnCniYTsuEn9pvz3bIy50",
  "content/posts/the-work-between-the-work.md": "1BQN_8E2vZWHurd6fh5-ZoqFB6SxCqQA0DzHhIE26AnY",
  "content/posts/the-gift-of-an-empty-mind.md": "1-VXH6e70Ug40xAMKfGV-ZRbSlvh-yHJF1ecUk_RU2go",
};

export function mappedGoogleDocId(path: string) {
  return documentIds[path] || "";
}

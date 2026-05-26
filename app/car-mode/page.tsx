import { db } from "@/lib/db/firebase";
import { CarModePlayer } from "@/components/podcast/car-mode-player";

export const dynamic = "force-dynamic";

export default async function CarModePage() {
  const firestore = db();

  // podcasts store audioUrl and topicSlug; we fetch topic names in parallel.
  const podcastsSnap = await firestore
    .collection("podcasts")
    .orderBy("createdAt", "desc")
    .get();

  const tracks = await Promise.all(
    podcastsSnap.docs.map(async (d) => {
      const pod = d.data();
      const topicSnap = await firestore.collection("topics").doc(pod.topicSlug).get();
      const topic = topicSnap.data();
      const isPre = d.id.endsWith("--pre");
      return {
        slug: pod.topicSlug as string,
        name: topic?.name as string,
        category: topic?.category as string,
        url: pod.audioUrl as string,
        script: (pod.script ?? []) as { speaker: string; text: string; startS?: number; endS?: number }[],
        podType: isPre ? "pre" : "post",
      };
    }),
  );

  return <CarModePlayer tracks={tracks.filter((t) => t.url)} />;
}

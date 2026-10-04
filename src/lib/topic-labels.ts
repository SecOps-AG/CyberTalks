import taxonomy from "../../data/taxonomy.json";

export function topicLabels(): Record<string, string> {
  return taxonomy.topicLabels as Record<string, string>;
}

export function topicLabel(topic: string): string {
  const labels = taxonomy.topicLabels as Record<string, string>;
  return labels[topic] ?? topic;
}

"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { AnalysisResult, LawChunk } from "@/lib/types";

interface SidePDF {
  scenario: string;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
  modelId: string;
}

interface ComparisonPDFProps {
  left: SidePDF;
  right: SidePDF;
  generatedAt: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#1c1e25",
    lineHeight: 1.55,
  },
  brand: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#154651",
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  meta: {
    fontSize: 8,
    color: "#5c5f69",
    marginBottom: 12,
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 8,
    color: "#5c5f69",
    marginTop: 8,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  text: {
    fontSize: 9.5,
    lineHeight: 1.55,
  },
  badge: {
    fontSize: 8,
    color: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    marginRight: 6,
  },
  scenarioBlock: {
    backgroundColor: "#f7f7f8",
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#5c5f69",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#d9dade",
    paddingTop: 8,
  },
  pageNumber: {
    position: "absolute",
    bottom: 12,
    right: 24,
    fontSize: 8,
    color: "#5c5f69",
  },
});

const STEPS: ReadonlyArray<{ field: keyof AnalysisResult; title: string }> = [
  { field: "step2LegalClassification", title: "Classification" },
  { field: "step5SentencingFramework", title: "Sentencing" },
  { field: "step7Conclusion", title: "Conclusion" },
];

function badgeColor(level: AnalysisResult["confidenceLevel"]): string {
  switch (level) {
    case "HIGH":
      return "#15803d";
    case "MEDIUM":
      return "#a16207";
    case "LOW":
      return "#c2410c";
    default:
      return "#b91c1c";
  }
}

function Side({ side }: { side: SidePDF }): React.ReactElement {
  return (
    <View style={styles.col}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <Text
          style={[
            styles.badge,
            { backgroundColor: badgeColor(side.result.confidenceLevel) },
          ]}
        >
          {side.result.confidenceLevel.replace("_", " ")}
        </Text>
        <Text style={{ fontSize: 9, color: "#5c5f69" }}>{side.modelId}</Text>
      </View>
      <View style={styles.scenarioBlock}>
        <Text style={styles.label}>Scenario</Text>
        <Text style={styles.text}>{side.scenario}</Text>
      </View>
      {STEPS.map((step) => {
        const value = side.result[step.field];
        const text = typeof value === "string" ? value : "";
        return (
          <View key={step.field}>
            <Text style={styles.label}>{step.title}</Text>
            <Text style={styles.text}>{text}</Text>
          </View>
        );
      })}
      <Text style={styles.label}>Estimated punishment</Text>
      <Text style={styles.text}>{side.result.estimatedPunishment}</Text>
    </View>
  );
}

export function ComparisonPDF({
  left,
  right,
  generatedAt,
}: ComparisonPDFProps): React.ReactElement {
  return (
    <Document title={`HUKM Comparison ${generatedAt}`} author="HUKM">
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.brand}>HUKM</Text>
        <Text style={styles.title}>Side-by-side comparison</Text>
        <Text style={styles.meta}>Generated {generatedAt}</Text>
        <View style={styles.twoCol}>
          <Side side={left} />
          <Side side={right} />
        </View>
        <Text style={styles.footer} fixed>
          {left.result.disclaimer}
        </Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

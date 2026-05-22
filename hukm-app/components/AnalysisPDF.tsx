"use client";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { AnalysisResult, LawChunk } from "@/lib/types";

interface AnalysisPDFProps {
  scenario: string;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
  modelId: string;
  generatedAt: string;
  language?: "en" | "am";
}

const colors = {
  ink: "#1c1e25",
  inkMuted: "#5c5f69",
  border: "#d9dade",
  surface: "#f7f7f8",
  accent: "#154651",
  badgeHigh: "#15803d",
  badgeMedium: "#a16207",
  badgeLow: "#c2410c",
  badgeReview: "#b91c1c",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.ink,
    lineHeight: 1.55,
  },
  header: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  brand: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.accent,
    letterSpacing: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 4,
    color: colors.ink,
  },
  meta: {
    fontSize: 9,
    color: colors.inkMuted,
    marginTop: 4,
  },
  scenarioBlock: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    padding: 10,
    marginBottom: 14,
  },
  label: {
    fontSize: 9,
    color: colors.inkMuted,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  paragraph: {
    fontSize: 10,
    color: colors.ink,
    lineHeight: 1.55,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 8,
  },
  badge: {
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    color: "#fff",
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.accent,
    marginBottom: 4,
  },
  step: {
    marginTop: 10,
  },
  stepHeader: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.ink,
    marginBottom: 2,
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tableCell: {
    fontSize: 9,
    color: colors.ink,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  colArticle: { flex: 3, paddingRight: 6 },
  colDoc: { flex: 2, paddingRight: 6 },
  colSim: { flex: 1, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: colors.inkMuted,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  pageNumber: {
    position: "absolute",
    bottom: 12,
    right: 24,
    fontSize: 8,
    color: colors.inkMuted,
  },
});

const STEP_LABELS: ReadonlyArray<{
  field: keyof AnalysisResult;
  title: string;
}> = [
  { field: "step1FactIdentification", title: "Step 1 — Fact identification" },
  { field: "step2LegalClassification", title: "Step 2 — Legal classification" },
  { field: "step3ElementsAnalysis", title: "Step 3 — Elements" },
  { field: "step4DefensesAndMitigation", title: "Step 4 — Defences & mitigation" },
  { field: "step5SentencingFramework", title: "Step 5 — Sentencing framework" },
  { field: "step6PrecedentApplication", title: "Step 6 — Precedent" },
  { field: "step7Conclusion", title: "Step 7 — Conclusion" },
];

function badgeColor(level: AnalysisResult["confidenceLevel"]): string {
  switch (level) {
    case "HIGH":
      return colors.badgeHigh;
    case "MEDIUM":
      return colors.badgeMedium;
    case "LOW":
      return colors.badgeLow;
    default:
      return colors.badgeReview;
  }
}

export function AnalysisPDF({
  scenario,
  result,
  retrievedChunks,
  modelId,
  generatedAt,
}: AnalysisPDFProps): React.ReactElement {
  return (
    <Document
      title={`HUKM Analysis ${generatedAt}`}
      author="HUKM"
      subject="Ethiopian Criminal Law Analysis"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>HUKM</Text>
          <Text style={styles.title}>Ethiopian criminal law analysis</Text>
          <Text style={styles.meta}>
            Generated {generatedAt} · Model {modelId}
          </Text>
        </View>

        <View style={styles.badgeRow}>
          <Text
            style={[
              styles.badge,
              { backgroundColor: badgeColor(result.confidenceLevel) },
            ]}
          >
            {result.confidenceLevel.replace("_", " ")}
          </Text>
          <Text style={styles.paragraph}>{result.confidenceReason}</Text>
        </View>

        <View style={styles.scenarioBlock}>
          <Text style={styles.label}>Scenario</Text>
          <Text style={styles.paragraph}>{scenario}</Text>
        </View>

        {STEP_LABELS.map((entry) => {
          const value = result[entry.field];
          const text = typeof value === "string" ? value : "";
          return (
            <View key={entry.field} style={styles.step} wrap={false}>
              <Text style={styles.stepHeader}>{entry.title}</Text>
              <Text style={styles.paragraph}>{text}</Text>
            </View>
          );
        })}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estimated punishment</Text>
          <Text style={styles.paragraph}>{result.estimatedPunishment}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Procedural roadmap</Text>
          <Text style={styles.paragraph}>{result.proceduralRoadmap}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Source articles</Text>
          {retrievedChunks.length === 0 ? (
            <Text style={styles.paragraph}>
              No source articles were retrieved for this query.
            </Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader} fixed>
                <Text style={[styles.tableCell, styles.colArticle]}>
                  Article
                </Text>
                <Text style={[styles.tableCell, styles.colDoc]}>Document</Text>
                <Text style={[styles.tableCell, styles.colSim]}>Similarity</Text>
              </View>
              {retrievedChunks.map((c) => (
                <View key={c.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.colArticle]}>
                    {c.article_reference}
                  </Text>
                  <Text style={[styles.tableCell, styles.colDoc]}>
                    {c.document_name}
                  </Text>
                  <Text style={[styles.tableCell, styles.colSim]}>
                    {(c.similarity * 100).toFixed(1)}%
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.footer} fixed>
          {result.disclaimer}
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

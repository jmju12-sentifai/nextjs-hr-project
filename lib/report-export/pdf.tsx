import React from "react";
import path from "node:path";
import {
  Document,
  Page,
  Text,
  View,
  Font,
  Svg,
  Circle,
  Path,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ExportBlock, ExportDocument, ExportRow } from "./model";

let registered = false;
export function registerReportFont() {
  if (registered) return;
  Font.register({
    family: "ReportKR",
    fonts: [400, 700].map((fontWeight) => ({
      src: path.join(
        process.cwd(),
        `public/fonts/NotoSansKR-${fontWeight}.ttf`,
      ),
      fontWeight,
    })),
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
const ink = "#071a3b",
  line = "#e4ebf5",
  soft = "#f2f6fc",
  muted = "#718099",
  colors = ["#1858f2", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
function Ring({ rows, accent }: { rows: ExportRow[]; accent: string }) {
  let offset = -Math.PI / 2;
  return (
    <Svg width={58} height={58} viewBox="0 0 66 66">
      <Circle
        cx="33"
        cy="33"
        r="25"
        stroke={line}
        strokeWidth="9"
        fill="none"
      />
      {rows.map((row, i) => {
        const ratio = Math.max(0, Math.min(1, row.ratio || 0)),
          start = offset;
        offset += ratio * Math.PI * 2;
        const stroke = rows.length === 1 ? accent : colors[i % colors.length];
        if (ratio === 1)
          return (
            <Circle
              key={i}
              cx="33"
              cy="33"
              r="25"
              stroke={stroke}
              strokeWidth="9"
              fill="none"
            />
          );
        if (!ratio) return null;
        const xy = (a: number) =>
          `${33 + 25 * Math.cos(a)} ${33 + 25 * Math.sin(a)}`;
        return (
          <Path
            key={i}
            d={`M ${xy(start)} A 25 25 0 ${ratio > 0.5 ? 1 : 0} 1 ${xy(offset)}`}
            stroke={stroke}
            strokeWidth="9"
            fill="none"
          />
        );
      })}
    </Svg>
  );
}
function Rows({ b, accent }: { b: ExportBlock; accent: string }) {
  const bars =
    ["compare", "bar", "bandtable"].includes(b.type) ||
    (b.type === "flow" && b.variant === "waterfall");
  const max = Math.max(1, ...b.rows.map((r) => r.amount || 0));
  return (
    <View>
      {b.rows.map((r, i) => (
        <View
          key={i}
          wrap={false}
          style={{
            paddingVertical: 3,
            borderBottomWidth: 0.5,
            borderBottomColor: line,
            backgroundColor: r.strong ? soft : "white",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                flex: 1,
                fontWeight: r.strong ? 700 : 400,
                color: r.muted ? muted : ink,
              }}
            >
              {r.label}
              {r.muted ? " · 제외" : ""}
            </Text>
            <Text
              style={{
                fontWeight: r.strong ? 700 : 400,
                color: r.muted ? muted : ink,
              }}
            >
              {r.value}
            </Text>
          </View>
          {r.note && !r.muted && (
            <Text style={{ fontSize: 7.2, color: muted, marginTop: 2 }}>
              {r.note}
            </Text>
          )}
          {bars && r.amount !== undefined && (
            <View style={{ height: 5, marginTop: 3, backgroundColor: soft }}>
              <View
                style={{
                  height: 5,
                  width: `${Math.max(0, Math.min(100, (r.amount / max) * 100))}%`,
                  backgroundColor: accent,
                }}
              />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
function Block({
  b,
  accent,
  legacy,
}: {
  b: ExportBlock;
  accent: string;
  legacy?: (el: any) => React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      {b.title && (
        <Text
          minPresenceAhead={30}
          style={{ fontWeight: 700, fontSize: 10, marginBottom: 6, color: ink }}
        >
          {b.title}
        </Text>
      )}
      {b.type === "headline" ? (
        <Text
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: accent,
            lineHeight: 1.45,
          }}
        >
          {b.text}
        </Text>
      ) : (
        b.text && (
          <Text
            style={{
              fontSize: b.type === "formula" ? 10 : 9.2,
              lineHeight: 1.5,
              backgroundColor: b.type === "formula" ? soft : undefined,
              padding: b.type === "formula" ? 8 : 0,
            }}
          >
            {b.text}
          </Text>
        )
      )}
      {b.type === "formula" && b.secondary && (
        <Text
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accent,
            backgroundColor: soft,
            padding: 8,
            marginBottom: 4,
          }}
        >
          {b.secondary}
        </Text>
      )}
      {["kpis", "gauge", "counts"].includes(b.type) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {b.rows.map((r, i) => (
            <View
              key={i}
              wrap={false}
              style={{
                width:
                  b.rows.length === 1
                    ? "100%"
                    : b.rows.length === 2
                      ? "49%"
                      : b.rows.length === 4
                        ? "24%"
                        : "32%",
                minHeight: 65,
                padding: 9,
                borderRadius: 7,
                backgroundColor: i === 0 && b.type === "kpis" ? accent : soft,
              }}
            >
              <Text
                style={{
                  fontSize: 8,
                  color: i === 0 && b.type === "kpis" ? "white" : muted,
                }}
              >
                {r.label}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: i === 0 && b.type === "kpis" ? "white" : ink,
                    flexShrink: 1,
                  }}
                >
                  {r.value}
                </Text>
                {r.ratio !== undefined &&
                  r.display !== "value" &&
                  r.display !== "bar" && (
                    <Ring rows={[r]} accent={i === 0 ? "#d8ff22" : accent} />
                  )}
              </View>
              {r.display === "bar" && r.ratio !== undefined && (
                <View
                  style={{ height: 5, backgroundColor: line, marginTop: 5 }}
                >
                  <View
                    style={{
                      height: 5,
                      width: `${Math.min(100, Math.max(0, r.ratio * 100))}%`,
                      backgroundColor: i === 0 ? "#d8ff22" : accent,
                    }}
                  />
                </View>
              )}
              {r.note && (
                <Text style={{ fontSize: 7, color: muted }}>{r.note}</Text>
              )}
            </View>
          ))}
        </View>
      ) : b.type === "itemized" ? (
        <View>
          {b.variant === "donut" ? (
            <Ring
              rows={b.rows.filter((r) => r.ratio !== undefined)}
              accent={accent}
            />
          ) : (
            b.variant === "bar" && (
              <View
                style={{ height: 12, flexDirection: "row", marginBottom: 5 }}
              >
                {b.rows
                  .filter((r) => r.ratio !== undefined)
                  .map((r, i) => (
                    <View
                      key={i}
                      style={{
                        width: `${(r.ratio || 0) * 100}%`,
                        backgroundColor: colors[i % colors.length],
                      }}
                    />
                  ))}
              </View>
            )
          )}
          <Rows b={b} accent={accent} />
        </View>
      ) : b.type === "element" ? (
        legacy?.(b.element)
      ) : (
        !!b.rows.length && <Rows b={b} accent={accent} />
      )}
      {b.secondary && b.type !== "formula" && (
        <Text style={{ fontSize: 7.5, color: muted, marginTop: 4 }}>
          {b.secondary}
        </Text>
      )}
    </View>
  );
}
export async function renderDocumentPdf(
  model: ExportDocument,
  legacy?: (el: any) => React.ReactNode,
) {
  registerReportFont();
  return renderToBuffer(
    <Document title={model.title} author={model.issuer.company || "HRcoach"}>
      {model.pages.map((blocks, i) => (
        <Page
          key={i}
          size="A4"
          style={{
            fontFamily: "ReportKR",
            fontSize: 8.5,
            color: ink,
            padding: 32,
            paddingBottom: 47,
            lineHeight: 1.4,
          }}
        >
          <View
            style={{
              backgroundColor: i === 0 ? ink : soft,
              padding: i === 0 ? 17 : 9,
              marginBottom: 15,
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 8, color: i === 0 ? "#c6d0df" : muted }}>
              {model.pathLabel}
              {model.issuer.company ? ` · ${model.issuer.company}` : ""}
            </Text>
            <Text
              style={{
                fontSize: i === 0 ? 20 : 11,
                fontWeight: 700,
                color: i === 0 ? "white" : ink,
                marginTop: 5,
              }}
            >
              {model.title}
            </Text>
            {i === 0 && (
              <Text style={{ fontSize: 8, color: "white", marginTop: 10 }}>
                {[
                  ...model.subjects.map((s) => `${s.label} ${s.value}`),
                  `발행일 ${model.issuedAt}`,
                ].join("   ·   ")}
              </Text>
            )}
          </View>
          {blocks.map((b) => (
            <Block key={b.id} b={b} accent={model.accent} legacy={legacy} />
          ))}
          <View
            fixed
            style={{
              position: "absolute",
              bottom: 22,
              left: 32,
              right: 32,
              borderTopWidth: 0.5,
              borderTopColor: line,
              paddingTop: 6,
              flexDirection: "row",
              justifyContent: "space-between",
              fontSize: 7,
              color: muted,
            }}
          >
            <Text>
              {[
                model.issuer.company,
                model.issuer.dept,
                model.issuer.contact && `문의 ${model.issuer.contact}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `${pageNumber} / ${totalPages}`
              }
            />
          </View>
        </Page>
      ))}
    </Document>,
  );
}

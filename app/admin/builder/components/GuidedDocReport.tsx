"use client";
import type { ComponentProps } from "react";
import DocReport from "./DocReport";
import { useReportGuide } from "./useReportGuide";

export default function GuidedDocReport(props: ComponentProps<typeof DocReport>) {
  const { guide } = useReportGuide();
  return <DocReport {...props} accent={props.accent || guide.accent} />;
}

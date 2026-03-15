import { Card, CardContent } from "@/components/ui/card";
import { WarningCircle } from "@phosphor-icons/react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <WarningCircle className="h-8 w-8 text-score-critical" />
            <h1 className="text-2xl font-bold text-foreground">404 — Página não encontrada</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            A página que você procura não existe.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

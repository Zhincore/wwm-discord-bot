import { Children, PropsWithChildren } from "@kitajs/html";
import safeCss from "./layout.css" with { type: "text" };

export interface LayoutProps {
  title: string;
  head?: Children;
}

export function Layout({
  children,
  head,
  title,
}: PropsWithChildren<LayoutProps>) {
  return (
    <>
      {"<!DOCTYPE html>"}
      <html>
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
          />
          <meta name="color-scheme" content="light dark" />
          <meta name="supported-color-schemes" content="light dark" />
          <style>{safeCss}</style>
          <title>Chirpy | Where Winds Meet Discord Bot</title>
          {head}
        </head>
        <body>
          <header>
            <h1>
              Chirpy
              <span class="dim"> | Where Winds Meet Discord Bot</span>
            </h1>
          </header>
          <main>
            <h1 safe>{title}</h1>
            {children}
          </main>
        </body>
      </html>
    </>
  );
}

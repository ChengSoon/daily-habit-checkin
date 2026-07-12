type BackNavigation<Href> = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: Href) => void;
};

export function goBackOrReplace<Href>(navigation: BackNavigation<Href>, fallback: Href): void {
  if (navigation.canGoBack()) {
    navigation.back();
    return;
  }

  navigation.replace(fallback);
}

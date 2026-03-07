from typing import List, Optional
from database.tables import ProductModel
from api.schemas import WellConfigInput

class RuleEngine:
    def __init__(self, products: List[ProductModel], config: WellConfigInput):
        self.products = products
        self.config = config

    def get_lowest_dennica(self) -> Optional[ProductModel]:
        """ Wybiera najniższą dennicę dla danego DN ze zdefiniowanego magazynu """
        dennicy = [p for p in self.products if p.componentType == "dennica" and p.dn == self.config.dn]
        if not dennicy:
            return None
        # Najpierw preferencja standardowych (forma std = 1 -> wyższa waga), potem wysokość
        # Sortowanie: (-forma_std, height)
        attr_forma = 'formaStandardowaWL' if self.config.warehouse == 'WL' else 'formaStandardowaKLB'
        dennicy.sort(key=lambda x: (-getattr(x, attr_forma, 0), x.height))
        return dennicy[0]

    def get_reduction_plate(self) -> Optional[ProductModel]:
        """ Szuka płyty redukcyjnej (zawsze z DN do DN1000) """
        if not self.config.use_reduction or self.config.dn <= 1000:
            return None
        # Z założenia redukcja sprowadza z self.config.dn np. 1500, 2000 na 1000. Szukamy "plyta_redukcyjna"
        plates = [p for p in self.products if p.componentType == "plyta_redukcyjna" and p.dn == self.config.dn]
        return plates[0] if plates else None

    def get_top_closure(self, is_reduced: bool, fallback_to_din: bool = False) -> ProductModel:
        """
        Dobór zakończenia. Zawsze próbuje Konus. Jeśli wymuszone w config, to używa wymuszonego.
        Jeżeli fallback_to_din == True (bo przechodzi np. otwór), wymusza Płytę DIN.
        """
        top_dn = 1000 if is_reduced else self.config.dn
        
        # Jeśli użytkownik wymusił coś w UI (np. "PDD-20")
        if self.config.forced_top_closure_id and not fallback_to_din:
            forced = next((p for p in self.products if p.id == self.config.forced_top_closure_id), None)
            if forced and (forced.dn == top_dn or forced.dn is None):
                return forced
                
        # Domyślnie Konus (jeśli istnieje dla danego DN - z reguły tylko DN1000, 1200?)
        attr_forma = 'formaStandardowaWL' if self.config.warehouse == 'WL' else 'formaStandardowaKLB'
        
        candidates_konus = [p for p in self.products if p.componentType == "konus" and p.dn == top_dn]
        candidates_din = [p for p in self.products if p.componentType == "plyta_din" and p.dn == top_dn]
        
        candidates_konus.sort(key=lambda x: -getattr(x, attr_forma, 0))
        candidates_din.sort(key=lambda x: -getattr(x, attr_forma, 0))

        if fallback_to_din:
            if candidates_din: return candidates_din[0]
            if candidates_konus: return candidates_konus[0]
            return None

        # Preferuj Konus, jeśli nie było wymuszenia i fallbacku
        if candidates_konus:
            return candidates_konus[0]
        elif candidates_din:
            return candidates_din[0]
            
        return None

    def get_kregi_list(self, dn: int) -> List[ProductModel]:
        """ Wylistuj kręgi dla danej średnicy """
        kregi = [p for p in self.products if p.componentType in ["krag", "krag_ot"] and p.dn == dn]
        attr_forma = 'formaStandardowaWL' if self.config.warehouse == 'WL' else 'formaStandardowaKLB'
        # Sortuj, żeby standardowe były na liście "lepsze" (ale optimizer będzie ich używał wg wysokości)
        kregi.sort(key=lambda x: (-getattr(x, attr_forma, 0), -x.height))
        return kregi

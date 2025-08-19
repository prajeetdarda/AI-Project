import torch
import torch.nn as nn

class HeadReg(nn.Module):
    def __init__(self, d_in):
        super().__init__()
        self.fc = nn.Linear(d_in, 1)
    def forward(self, h):
        return self.fc(h).squeeze(1)

class HeadCls(nn.Module):
    def __init__(self, d_in, n_classes):
        super().__init__()
        self.fc = nn.Linear(d_in, n_classes)
    def forward(self, h):
        return self.fc(h)

class MTModel(nn.Module):
    def __init__(self, d_in, hidden, dropout, class_maps, reg_cols):
        super().__init__()
        self.trunk = nn.Sequential(
            nn.Linear(d_in, hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden, hidden // 2),
            nn.ReLU(),
        )
        h = hidden // 2
        self.reg_cols = list(reg_cols)
        self.cls_cols = list(class_maps.keys())
        self.reg_heads = nn.ModuleDict({c: HeadReg(h) for c in self.reg_cols})
        self.cls_heads = nn.ModuleDict({
            c: HeadCls(h, len(class_maps[c]["classes"]))
            for c in self.cls_cols
        })

    def forward(self, x):
        h = self.trunk(x)
        out = {}
        for c, head in self.reg_heads.items():
            out[f"reg_{c}"] = head(h)
        for c, head in self.cls_heads.items():
            out[f"cls_{c}"] = head(h)
        return out